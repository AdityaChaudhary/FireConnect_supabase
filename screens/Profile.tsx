import React, { useState, useRef } from 'react';
import type { MetaFunction } from "react-router";
import { useNavigate, useLoaderData } from 'react-router';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase.client';
import { createSupabaseServerClient } from '../lib/supabase.server';
import { AVAILABLE_INTERESTS } from '../lib/config';
import { blurImage, compressImage } from '../lib/image-utils';
import CdnImage from '../components/CdnImage';
import { useProfileImages, useSpyCount } from '../hooks/useData';
import type { Route } from './+types/Profile';

export const meta: MetaFunction = () => {
    return [
        { title: "My Profile | FireConnect" },
        { name: "description", content: "Manage your profile, shared media, and spy credits on FireConnect." },
    ];
};

export async function loader({ request }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { images: [], spyCount: 0 };

    const { data: rpcData, error } = await supabase.rpc('get_profile_view_data', { 
        p_target_user_id: user.id 
    });

    if (error) {
        console.error("RPC Error:", error);
        return { images: [], spyCount: 0 };
    }

    const viewData = rpcData as unknown as import('../config/rpc').ProfileViewData;

    return {
        images: viewData.images || [],
        spyCount: viewData.spy_count || 0
    };
}

const Profile: React.FC = () => {
    const { user, profile, stripeRole, refreshProfile } = useAuth();
    const loaderData = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isAddInterestOpen, setIsAddInterestOpen] = useState(false);
    const [interestToRemove, setInterestToRemove] = useState<string | null>(null);
    const [updatingInterests, setUpdatingInterests] = useState(false);

    const { data: images = [], refetch: refetchImages } = useProfileImages(user?.id || '', loaderData?.images);
    const { data: spyCount = 0 } = useSpyCount(user?.id, loaderData?.spyCount);

    const subscriptionLevel = (stripeRole || 'FREE').toUpperCase() as 'FREE' | 'PRO' | 'MAX';
    const displayName = profile?.display_name || user?.user_metadata?.full_name || 'User';


    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        setUploading(true);
        try {
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const storagePath = `users/${user.id}/shared/${activeTab}/${fileName}`;
            let blurredPath: string | undefined;

            // Compress Image
            const compressedBlob = await compressImage(file);

            // Upload Original
            const bucket = activeTab === 'PRIVATE' ? 'private-media' : 'public-media';
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(storagePath, compressedBlob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            // Handle Private Image Blurring
            if (activeTab === 'PRIVATE') {
                try {
                    const blurredBlob = await blurImage(file);
                    blurredPath = `users/${user.id}/shared/PUBLIC/blurred/blurred_${fileName}`;

                    const { error: blurUploadError } = await supabase.storage
                        .from('public-media')
                        .upload(blurredPath, blurredBlob, { contentType: 'image/jpeg' });

                    if (blurUploadError) throw blurUploadError;
                } catch (blurErr) {
                    console.error("Error generating/uploading blurred preview:", blurErr);
                }
            }

            // Insert Record
            const { error: insertError } = await supabase
                .from('profile_images')
                .insert({
                    user_id: user.id,
                    url: storagePath,
                    visibility: activeTab,
                    is_profile: false,
                    display_order: images.length,
                    blurred_url: blurredPath
                });

            if (insertError) throw insertError;

            await refetchImages();
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteClick = (id: string) => {
        setImageToDelete(id);
    };

    const confirmDelete = async () => {
        if (!imageToDelete) return;

        setDeletingId(imageToDelete);
        const idToDelete = imageToDelete;
        setImageToDelete(null);

        try {
            const { data: imgData, error: fetchError } = await supabase
                .from('profile_images')
                .select('url, blurred_url, visibility')
                .eq('id', idToDelete)
                .single();

            if (fetchError) throw fetchError;

            // Delete from storage
            const bucket = imgData.visibility === 'PRIVATE' ? 'private-media' : 'public-media';
            await supabase.storage.from(bucket).remove([imgData.url]);

            if (imgData.blurred_url) {
                // Blurred previews are always in public-media
                await supabase.storage.from('public-media').remove([imgData.blurred_url]);
            }

            // Delete from DB
            const { error: deleteError } = await supabase
                .from('profile_images')
                .delete()
                .eq('id', idToDelete);

            if (deleteError) throw deleteError;

            await refetchImages();
        } catch (error) {
            console.error("Error deleting image:", error);
            alert("Failed to delete image.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleAddInterest = async (interest: string) => {
        if (!profile || (profile.interests?.length || 0) >= 5) return;
        if (profile.interests?.includes(interest)) {
            setIsAddInterestOpen(false);
            return;
        }

        setUpdatingInterests(true);
        try {
            const newInterests = [...(profile.interests || []), interest];
            const { error } = await supabase
                .from('users')
                .update({ interests: newInterests })
                .eq('id', user?.id);

            if (error) throw error;
            await refreshProfile();
            setIsAddInterestOpen(false);
        } catch (error) {
            console.error("Error adding interest:", error);
        } finally {
            setUpdatingInterests(false);
        }
    };

    const handleRemoveInterest = async () => {
        if (!interestToRemove || !profile) return;

        setUpdatingInterests(true);
        try {
            const newInterests = (profile.interests || []).filter((i: string) => i !== interestToRemove);
            const { error } = await supabase
                .from('users')
                .update({ interests: newInterests })
                .eq('id', user?.id);

            if (error) throw error;
            await refreshProfile();
            setInterestToRemove(null);
        } catch (error) {
            console.error("Error removing interest:", error);
        } finally {
            setUpdatingInterests(false);
        }
    };

    const filteredImages = images.filter(img => img.visibility === activeTab);

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden pb-24 text-white">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleUpload}
            />

            <header className="sticky top-0 z-20 flex w-full items-center justify-between bg-background-dark/80 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <span className="text-white text-xl font-bold tracking-tight">My Profile</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/subscription')}
                        className={`flex items-center gap-2 rounded-full px-3 py-1.5 border transition-all active:scale-95 ${subscriptionLevel === 'MAX'
                            ? 'bg-gradient-to-r from-purple-600 to-primary border-transparent text-white shadow-lg shadow-primary/20'
                            : subscriptionLevel === 'PRO'
                                ? 'bg-primary/20 border-primary shadow-sm text-primary font-bold'
                                : 'bg-surface-dark border-white/5 text-white/80 hover:bg-white/10'
                            }`}
                    >
                        <Icon
                            name={subscriptionLevel === 'MAX' ? "workspace_premium" : subscriptionLevel === 'PRO' ? "stars" : "bolt"}
                            className={`text-[18px] ${subscriptionLevel === 'MAX' ? 'text-white' : 'text-primary'}`}
                            filled
                        />
                        <span className="text-xs font-bold uppercase tracking-wide">
                            {subscriptionLevel === 'MAX' ? 'Max Member' : subscriptionLevel === 'PRO' ? 'Pro User' : 'Upgrade'}
                        </span>
                    </button>
                    <button
                        onClick={() => navigate('/settings')}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all">
                        <Icon name="settings" />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center px-4 pt-4 gap-6 w-full max-w-md mx-auto">
                <div className="flex w-full flex-col items-center gap-5">
                    <div className="relative">
                        <div className="h-32 w-32 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-xl shadow-primary/20">
                            <CdnImage
                                key={profile?.profile_picture_url || 'default'}
                                path={profile?.profile_picture_url}
                                gender={profile?.gender}
                                seed={user?.id}
                                className="h-full w-full rounded-full object-cover border-4 border-background-dark"
                            />
                        </div>
                        <div className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background-dark border-2 border-background-dark">
                            <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {displayName}
                            <Icon name="verified" className="text-blue-400 text-[20px]" filled />
                        </h2>
                        <p className="text-white/60 text-sm font-medium flex items-center gap-1">
                            <Icon name="alternate_email" className="text-[14px]" />
                            {profile?.username || 'Username'}
                        </p>
                        {profile?.location && (
                            <p className="text-primary/80 text-[12px] font-bold flex items-center gap-1 mt-0.5">
                                <Icon name="location_on" className="text-[14px]" />
                                {profile.location}
                            </p>
                        )}
                    </div>
                    <div className="flex w-full max-w-[320px] gap-3">
                        <button
                            onClick={() => navigate('/profile/edit')}
                            className="flex-1 h-11 rounded-full bg-primary text-white text-sm font-bold tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="edit" className="text-[18px]" />
                            Edit Profile
                        </button>
                        <button
                            onClick={() => navigate(`/profile/${user?.id}`)}
                            className="flex-1 h-11 rounded-full bg-surface-dark border border-white/10 text-white text-sm font-bold tracking-wide hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="visibility" className="text-[18px]" />
                            Preview
                        </button>
                    </div>
                </div>

                <div className="flex w-full justify-center gap-3">
                    <div
                        id="tour-spy-list"
                        onClick={() => navigate('/spy-list')}
                        className="flex w-[140px] flex-col items-center justify-center gap-1 rounded-xl bg-surface-dark border border-white/5 p-3 active:scale-95 transition-transform cursor-pointer"
                    >
                        <p className="text-white text-xl font-bold">{spyCount}</p>
                        <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Spy List</p>
                    </div>
                    <div
                        id="tour-spy-credits"
                        onClick={() => navigate('/purchase-credits')}
                        className="flex w-[140px] flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/20 border border-primary/30 p-3 active:scale-95 transition-transform cursor-pointer group"
                    >
                        <Icon name="visibility" className="text-primary group-hover:animate-pulse" />
                        <p className="text-white text-base font-bold">
                            {subscriptionLevel === 'MAX' ? '∞' : (profile?.spy_credits || 0)}
                        </p>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-tight">Spy Credits</p>
                    </div>
                </div>

                <div className="w-full text-center px-2">
                    <p className="text-white/90 text-sm leading-relaxed">
                        {profile?.bio || 'Add a bio to your profile to let people know more about you.'}
                    </p>
                </div>

                <div className="flex w-full flex-wrap justify-center gap-2">
                    {profile?.interests?.map((interest: string) => (
                        <div
                            key={interest}
                            onClick={() => setInterestToRemove(interest)}
                            className="flex items-center justify-center rounded-full bg-surface-dark border border-primary/20 bg-primary/5 px-4 py-2 hover:bg-primary/10 transition-all cursor-pointer group active:scale-95"
                        >
                            <p className="text-white text-xs font-semibold tracking-wide flex items-center gap-2">
                                {interest}
                                <Icon name="close" className="text-[14px] text-white/30 group-hover:text-red-400 transition-colors" />
                            </p>
                        </div>
                    ))}
                    {(profile?.interests?.length || 0) < 5 && (
                        <button
                            onClick={() => setIsAddInterestOpen(true)}
                            className="flex items-center justify-center rounded-full bg-surface-dark border border-white/10 px-4 py-2 hover:bg-white/5 hover:border-primary/50 transition-all cursor-pointer active:scale-95 text-primary"
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="add" className="text-[18px]" />
                                <p className="text-xs font-bold tracking-wide uppercase">Add Interest</p>
                            </div>
                        </button>
                    )}
                </div>

                <div className="w-full h-px bg-white/5 my-2"></div>

                <div id="tour-shared-media" className="flex w-full flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between w-full">
                        <h3 className="text-white text-base font-bold">Shared Media</h3>
                        <div className="flex bg-surface-dark rounded-full p-1 border border-white/5">
                            <button
                                onClick={() => setActiveTab('PUBLIC')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'PUBLIC' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                            >
                                Public
                            </button>
                            <button
                                onClick={() => setActiveTab('PRIVATE')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'PRIVATE' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                            >
                                Private
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-[3/4] rounded-lg overflow-hidden bg-surface-dark relative group cursor-pointer flex items-center justify-center border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors"
                        >
                            {uploading ? (
                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-white/40 group-hover:text-primary transition-colors text-center p-2">
                                    <Icon name="add_circle" className="text-3xl" />
                                    <span className="text-[10px] font-bold uppercase">Add {activeTab === 'PUBLIC' ? 'Public' : 'Private'}</span>
                                </div>
                            )}
                        </div>

                        {filteredImages.map((img, idx) => (
                            <div
                                key={img.id || idx}
                                className="aspect-[3/4] rounded-lg overflow-hidden bg-surface-dark relative group cursor-pointer"
                                onClick={() => setPreviewImage(img.url)}
                            >
                                <CdnImage
                                    path={img.url}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(img.id);
                                    }}
                                    disabled={deletingId === img.id}
                                    className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white hover:bg-red-500 hover:text-white backdrop-blur-md transition-all active:scale-95"
                                >
                                    {deletingId === img.id ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <Icon name="close" className="text-[16px]" />
                                    )}
                                </button>

                                {img.visibility === 'PRIVATE' && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center justify-center shadow-sm border border-white/10">
                                        <Icon name="lock" className="text-[12px] text-primary" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <ConfirmDialog
                isOpen={!!imageToDelete}
                onClose={() => setImageToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Image"
                message="Are you sure you want to delete this image?"
                confirmText="Delete"
                type="danger"
                loading={deletingId !== null}
            />

            <ConfirmDialog
                isOpen={!!interestToRemove}
                onClose={() => setInterestToRemove(null)}
                onConfirm={handleRemoveInterest}
                title="Remove Interest"
                message={`Remove "${interestToRemove}"?`}
                confirmText="Remove"
                type="danger"
                loading={updatingInterests}
            />

            <Modal
                isOpen={isAddInterestOpen}
                onClose={() => setIsAddInterestOpen(false)}
                title="Add Interest"
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {AVAILABLE_INTERESTS.map((interest: string) => {
                            const isSelected = profile?.interests?.includes(interest);
                            return (
                                <button
                                    key={interest}
                                    onClick={() => !isSelected && handleAddInterest(interest)}
                                    disabled={isSelected || updatingInterests}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${isSelected
                                        ? 'bg-primary/20 border-primary/40 text-primary/50 cursor-default'
                                        : 'bg-surface-dark border-white/10 text-white hover:border-primary/50 active:scale-95'
                                        }`}
                                >
                                    {interest}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            {previewImage && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        <Icon name="close" className="text-[24px]" />
                    </button>
                    <CdnImage
                        path={previewImage}
                        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default Profile;
