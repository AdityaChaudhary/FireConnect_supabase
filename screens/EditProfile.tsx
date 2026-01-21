import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { compressImage, getDefaultAvatar } from '../lib/image-utils';
import CdnImage from '../components/CdnImage';

const EditProfile: React.FC = () => {
    const { user, profile, stripeRole, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [gender, setGender] = useState(profile?.gender || '');
    const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
    const [location, setLocation] = useState(profile?.location || '');
    const [latitude, setLatitude] = useState<number | null>(profile?.latitude || null);
    const [longitude, setLongitude] = useState<number | null>(profile?.longitude || null);
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.profile_picture_url || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [locating, setLocating] = useState(false);

    // Avatar Selection state
    const [isUsingGeneratedAvatar, setIsUsingGeneratedAvatar] = useState(false);

    const isPro = (stripeRole || 'FREE').toUpperCase() !== 'FREE';

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setBio(profile.bio || '');
            setGender(profile.gender || '');
            setDateOfBirth(profile.date_of_birth || '');
            setLocation(profile.location || '');
            setLatitude(profile.latitude || null);
            setLongitude(profile.longitude || null);
            setPreviewUrl(profile.profile_picture_url || null);
            setIsUsingGeneratedAvatar(false);
        }
    }, [profile, user]);

    const handleGetLocation = () => {
        if (!isPro) return;
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
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
                }
            },
            (err) => {
                console.error(err);
                setError("Failed to get location. Please allow location access.");
                setLocating(false);
            }
        );
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setIsUsingGeneratedAvatar(false);
        }
    };

    const handleRegenerateAvatar = () => {
        const newSeed = Math.random().toString(36).substring(7);
        setPreviewUrl(getDefaultAvatar(gender, newSeed));
        setIsUsingGeneratedAvatar(true);
        setImage(null);
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            let profilePictureUrl = profile?.profile_picture_url || '';

            if (image && user) {
                const timestamp = Date.now();
                const storagePath = `users/${user.id}/avatars/${timestamp}_${image.name}`;

                // Compress Avatar
                const compressedBlob = await compressImage(image, 512, 512, 0.9);

                const { error: uploadError } = await supabase.storage
                    .from('public-media')
                    .upload(storagePath, compressedBlob, { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;
                
                // Get public URL and store it directly, matching original Firebase behavior
                const { data: publicUrlData } = supabase.storage
                    .from('public-media')
                    .getPublicUrl(storagePath);
                
                profilePictureUrl = publicUrlData.publicUrl;
            } else if (isUsingGeneratedAvatar && previewUrl && user) {
                // Upload generated Multiavatar SVG
                const timestamp = Date.now();
                const storagePath = `users/${user.id}/avatars/${timestamp}_avatar.svg`;
                
                // Extract SVG data from the data URI
                const svgCode = decodeURIComponent(previewUrl.split(',')[1]);
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

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    display_name: displayName,
                    bio,
                    profile_picture_url: profilePictureUrl,
                    gender: gender as any,
                    date_of_birth: dateOfBirth,
                    location,
                    latitude,
                    longitude
                })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            await refreshProfile();
            navigate('/profile');
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-dark pb-24">
            <header className="sticky top-0 z-20 flex w-full items-center justify-between bg-background-dark/80 px-4 py-3 backdrop-blur-md border-b border-white/5">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
                    <Icon name="arrow_back" />
                </button>
                <h1 className="text-white text-lg font-bold">Edit Profile</h1>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="text-primary font-bold disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </header>

            <main className="flex-1 flex flex-col px-6 pt-8 gap-8 max-w-md mx-auto w-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        <div className="h-32 w-32 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-xl overflow-hidden">
                            {isUsingGeneratedAvatar && previewUrl && previewUrl.startsWith('data:') ? (
                                <div 
                                    dangerouslySetInnerHTML={{ __html: decodeURIComponent(previewUrl.split(',')[1]) }} 
                                    className="h-full w-full rounded-full border-4 border-background-dark bg-background-dark p-2"
                                />
                            ) : (
                                <CdnImage
                                    path={previewUrl}
                                    gender={gender}
                                    className="h-full w-full rounded-full object-cover border-4 border-background-dark bg-background-dark"
                                />
                            )}
                        </div>
                        
                        <div className="absolute -bottom-1 -right-1 flex gap-2">
                            <button
                                type="button"
                                onClick={handleRegenerateAvatar}
                                className="p-2.5 rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover transition-all active:scale-90"
                                title="Regenerate Avatar"
                            >
                                <Icon name="refresh" className="text-[18px]" />
                            </button>
                            <label className="p-2.5 rounded-full bg-surface-dark border border-white/10 text-white shadow-lg hover:bg-surface-dark/80 transition-all active:scale-90 cursor-pointer">
                                <Icon name="photo_camera" className="text-[18px]" />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-surface-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                            placeholder="Your Name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={4}
                            className="w-full bg-surface-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors resize-none"
                            placeholder="Tell us about yourself..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Gender</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-surface-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                        >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Date of Birth</label>
                        <input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="w-full bg-surface-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Location</label>
                            {!isPro && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Pro Only</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={location}
                                readOnly
                                className="flex-1 bg-surface-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none transition-opacity"
                                placeholder={isPro ? "Click to get location" : "Upgrade to Pro to change location"}
                            />
                            <button
                                type="button"
                                onClick={handleGetLocation}
                                disabled={!isPro || locating}
                                className={`p-3 rounded-xl transition-all border flex items-center justify-center min-w-[50px] ${isPro
                                    ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/20'
                                    : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
                                    }`}
                            >
                                {locating ? (
                                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                ) : (
                                    <Icon name="my_location" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                        <Icon name="error" className="text-red-400" />
                        <span className="text-red-400 text-sm font-medium">{error}</span>
                    </div>
                )}
            </main>
        </div>
    );
};

export default EditProfile;
