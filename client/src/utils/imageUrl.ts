export const getAvatarUrl = (avatarPath: string | null | undefined): string | null => {
    if (!avatarPath) return null;
    
    // If it's already an absolute URL (like from Google or a hosted service)
    if (avatarPath.startsWith('http')) return avatarPath;
    
    // If it's a relative path from our server (e.g., /uploads/avatars/...)
    // We assume the frontend is served from a domain that proxies /uploads to the backend
    // Or we use the VITE_API_URL but without the /api suffix if needed.
    
    // For local development with Vite proxy, just returning the relative path works
    // because Vite proxies /uploads to http://localhost:5000/uploads
    if (avatarPath.startsWith('/')) return avatarPath;
    
    return `/${avatarPath}`;
};
