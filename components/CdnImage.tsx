import React from 'react';
import { resolveImageUrl } from '../lib/image-resolver';

interface CdnImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    path: string | undefined;
}

const CdnImage: React.FC<CdnImageProps> = ({ path, className, ...props }) => {
    const url = resolveImageUrl(path);
    return <img src={url} className={className} {...props} />;
};

export default CdnImage;
