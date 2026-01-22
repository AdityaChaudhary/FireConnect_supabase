import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase.client';
import Icon from '../components/Icon';
import { compressImage, getDefaultAvatar } from '../lib/image-utils';

const Onboarding: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState(profile?.username || '');
    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [gender, setGender] = useState(profile?.gender || '');
    const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
    const [location, setLocation] = useState(profile?.location || '');
    const [latitude, setLatitude] = useState<number | null>(profile?.latitude || null);
    const [longitude, setLongitude] = useState<number | null>(profile?.longitude || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [locating, setLocating] = useState(false);
    const [isManualLocation, setIsManualLocation] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Avatar state
    const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>(getDefaultAvatar(null, avatarSeed));

    useEffect(() => {
        if (user?.user_metadata?.full_name && !displayName && !profile?.display_name) {
            setDisplayName(user.user_metadata.full_name);
        }
        if (profile) {
            if (profile.username) setUsername(profile.username);
            if (profile.display_name) setDisplayName(profile.display_name);
            if (profile.gender) setGender(profile.gender);
            if (profile.date_of_birth) setDateOfBirth(profile.date_of_birth);
            if (profile.location) setLocation(profile.location);
            if (profile.latitude) setLatitude(profile.latitude);
            if (profile.longitude) setLongitude(profile.longitude);
        }
    }, [user, profile]);

    const handleGetLocation = () => {
        setError('');
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setIsManualLocation(true);
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                setLatitude(lat);
                setLongitude(lng);

                try {
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
                    const data = await response.json();

                    const city = data.city || data.locality || data.principalSubdivision || "";
                    const country = data.countryName || "";

                    if (city && country) {
                        setLocation(`${city}, ${country}`);
                    } else if (city || country) {
                        setLocation(city || country);
                    } else {
                        setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }
                } catch (err) {
                    console.error("Reverse geocoding error:", err);
                    setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                } finally {
                    setLocating(false);
                    setIsManualLocation(false);
                }
            },
            (err) => {
                console.error(err);
                setError("Failed to get location. You can type it manually.");
                setLocating(false);
                setIsManualLocation(true);
            }
        );
    };

    const fetchCitySuggestions = async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&osm_tag=place:city&limit=5`);
            const data = await response.json();
            setSuggestions(data.features || []);
        } catch (err) {
            console.error("City suggestions error:", err);
        }
    };

    const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocation(val);
        setShowSuggestions(true);
        fetchCitySuggestions(val);
    };

    const handleSelectSuggestion = (suggestion: any) => {
        const { properties, geometry } = suggestion;
        const city = properties.name;
        const country = properties.country;
        const formatted = country ? `${city}, ${country}` : city;

        setLocation(formatted);
        setLatitude(geometry.coordinates[1]);
        setLongitude(geometry.coordinates[0]);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setUsername(val);
        if (!displayName || displayName === username) {
            setDisplayName(val);
        }
    };

    const handleRegenerateAvatar = () => {
        const newSeed = Math.random().toString(36).substring(7);
        setAvatarSeed(newSeed);
        setAvatarFile(null);
        setAvatarPreview(getDefaultAvatar(gender, newSeed));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!dateOfBirth) {
            setError("Please enter your date of birth.");
            return;
        }

        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 18) {
            setError("You must be at least 18 years old to join.");
            return;
        }

        if (!acceptedTerms) {
            setError("Please accept the Terms and Conditions.");
            return;
        }

        setLoading(true);

        try {
            let profilePictureUrl = '';

            if (avatarFile) {
                const timestamp = Date.now();
                const storagePath = `users/${user?.id}/avatars/${timestamp}_${avatarFile.name}`;
                const compressedBlob = await compressImage(avatarFile, 512, 512, 0.9);

                const { error: uploadError } = await supabase.storage
                    .from('public-media')
                    .upload(storagePath, compressedBlob, { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('public-media')
                    .getPublicUrl(storagePath);
                
                profilePictureUrl = publicUrlData.publicUrl;
            } else {
                // Use the multiavatar SVG
                const timestamp = Date.now();
                const storagePath = `users/${user?.id}/avatars/${timestamp}_avatar.svg`;
                
                // Get the SVG content
                const svgCode = decodeURIComponent(avatarPreview.split(',')[1]);
                const blob = new Blob([svgCode], { type: 'image/svg+xml' });

                const { error: uploadError } = await supabase.storage
                    .from('public-media')
                    .upload(storagePath, blob, { contentType: 'image/svg+xml' });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('public-media')
                    .getPublicUrl(storagePath);
                
                profilePictureUrl = publicUrlData.publicUrl;
            }

            const { error: upsertError } = await supabase
                .from('users')
                .upsert({
                    id: user?.id,
                    username,
                    display_name: displayName,
                    email: user?.email || '',
                    profile_picture_url: profilePictureUrl,
                    gender,
                    date_of_birth: dateOfBirth,
                    location,
                    latitude,
                    longitude,
                    is_onboarded: true
                });

            if (upsertError) throw upsertError;

            localStorage.setItem('just_onboarded', 'true');
            window.location.reload();
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("users_username_key") || err.code === "23505") {
                setError("Username is already taken. Please choose another one.");
            } else if (err.code === "23503") {
                // Foreign key violation (users_id_fkey) usually means the auth session exists 
                // but the user record isn't in auth.users (local mismatch).
                setError("Session error. Please sign out and sign in again.");
                // Optionally auto-logout to fix it for them, but messaging is safer.
            } else {
                setError(err.message || 'Failed to create profile');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background-dark relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>

            <div className="absolute top-6 right-6 z-20">
                <button
                    onClick={async () => {
                        if (isLoggingOut) return;
                        setIsLoggingOut(true);
                        try {
                            await logout();
                            navigate('/');
                        } catch (error) {
                            console.error('Logout failed:', error);
                            setIsLoggingOut(false);
                        }
                    }}
                    disabled={isLoggingOut}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all active:scale-95 group ${
                        isLoggingOut 
                        ? "bg-white/5 border-white/5 text-white/20 cursor-not-allowed" 
                        : "bg-surface-dark/40 hover:bg-surface-dark/60 border-white/5 text-white/70 hover:text-white"
                    }`}
                >
                    <Icon 
                        name={isLoggingOut ? "progress_activity" : "logout"} 
                        className={`text-[18px] ${isLoggingOut ? "animate-spin" : "group-hover:text-red-400 transition-colors"}`} 
                    />
                    <span className="text-xs font-bold tracking-wide uppercase">
                        {isLoggingOut ? "Signing Out..." : "Sign Out"}
                    </span>
                </button>
            </div>

            <div className="w-full max-w-sm z-10 flex flex-col gap-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-white">One last step!</h1>
                    <p className="text-white/50">Let's set up your profile.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-surface-dark/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="relative group">
                            <div className="h-28 w-28 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-xl overflow-hidden">
                                {avatarFile ? (
                                    <img 
                                        src={avatarPreview} 
                                        alt="Avatar Preview" 
                                        className="h-full w-full rounded-full object-cover border-4 border-background-dark bg-background-dark" 
                                    />
                                ) : (
                                    <div 
                                        dangerouslySetInnerHTML={{ __html: avatarPreview.startsWith('data:') ? decodeURIComponent(avatarPreview.split(',')[1]) : '' }} 
                                        className="h-full w-full rounded-full border-4 border-background-dark bg-background-dark p-2"
                                    />
                                )}
                            </div>
                            
                            <div className="absolute -bottom-1 -right-1 flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleRegenerateAvatar}
                                    className="p-2 rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover transition-all active:scale-90"
                                    title="Regenerate Avatar"
                                >
                                    <Icon name="refresh" className="text-[16px]" />
                                </button>
                                <label className="p-2 rounded-full bg-surface-dark border border-white/10 text-white shadow-lg hover:bg-surface-dark/80 transition-all active:scale-90 cursor-pointer">
                                    <Icon name="photo_camera" className="text-[16px]" />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Choose your look</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={handleUsernameChange}
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                placeholder="e.g. fire_spark"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                placeholder="How others will see you"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                            >
                                <option value="" disabled className="bg-background-dark">Select Gender</option>
                                <option value="MALE" className="bg-background-dark">Male</option>
                                <option value="FEMALE" className="bg-background-dark">Female</option>
                                <option value="OTHER" className="bg-background-dark">Other</option>
                                <option value="PREFER_NOT_TO_SAY" className="bg-background-dark">Prefer not to say</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Date of Birth</label>
                            <input
                                type="date"
                                value={dateOfBirth}
                                onChange={(e) => setDateOfBirth(e.target.value)}
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Location</label>
                            <div className="flex flex-col gap-2 relative">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={handleLocationInputChange}
                                        onFocus={() => {
                                            if (!location) setIsManualLocation(true);
                                            setShowSuggestions(true);
                                        }}
                                        placeholder={isManualLocation ? "Search for your city..." : "Click to get location"}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={locating}
                                        title="Auto-detect location"
                                        className="bg-primary/20 hover:bg-primary/30 text-primary p-3 rounded-xl transition-colors border border-primary/20 flex items-center justify-center min-w-[50px]"
                                    >
                                        {locating ? (
                                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                        ) : (
                                            <Icon name="my_location" />
                                        )}
                                    </button>
                                </div>

                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-dark border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSelectSuggestion(s)}
                                                className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/5 border-b border-white/5 last:border-0"
                                            >
                                                <span className="font-medium text-white">{s.properties.name}</span>
                                                {s.properties.state && <span className="text-white/40">, {s.properties.state}</span>}
                                                {s.properties.country && <span className="text-white/40">, {s.properties.country}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 px-1">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${acceptedTerms
                                    ? 'bg-primary border-primary scale-110'
                                    : 'bg-background-dark/50 border-white/20 group-hover:border-primary/50'
                                    }`}>
                                    {acceptedTerms && <Icon name="check" className="text-white text-[14px]" />}
                                </div>
                            </div>
                            <span className="text-xs text-white/50 select-none">
                                I accept the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Terms and Conditions</a>
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                            <Icon name="error" className="text-red-400 text-[18px]" />
                            <span className="text-red-400 text-xs font-medium">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username || !displayName || !gender || !dateOfBirth || !location || !acceptedTerms}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                        {loading ? 'Setting up...' : 'Get Started'}
                    </button>
                </form>
            </div >
        </div >
    );
};

export default Onboarding;
