"use client"
import { SystemImage } from '@/lib/types'
import { useState } from 'react'

interface ImageCarouselProps {
    images: SystemImage[]
    systemName: string
}

function ImageCarousel({ images, systemName }: ImageCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    function handleLeft() {
        if ((currentIndex - 1) < 0) {
            setCurrentIndex(images.length - 1)
        } else {
            setCurrentIndex(currentIndex - 1)
        }
    }
    function handleRight() {
        if ((currentIndex + 1) >= images.length) {
            setCurrentIndex(0)
        } else {
            setCurrentIndex(currentIndex + 1)
        }
    }
    if (images.length === 0) {
        return (
            <div className="aspect-4/3 w-full border border-hairline flex items-center justify-center">
                <p className="font-body text-text-muted text-sm">No images yet</p>
            </div>
        )
    }
    // Most systems have no images and the ones that do have different counts, so
    // the index is clamped rather than trusted: a stale value from a previous
    // system would otherwise read past the end and blank the image.
    const index = Math.min(currentIndex, images.length - 1)
    const image = images[index]
    return (
        <div className="flex flex-col gap-3">
            <div className="aspect-4/3 w-full border border-hairline overflow-hidden">
                <img
                    src={image.url}
                    alt={image.altText || `${systemName} image ${index + 1}`}
                    className="h-full w-full object-contain"
                />
            </div>
            {images.length > 1 && (
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleLeft}
                        aria-label="Previous image"
                        className="border border-hairline text-accent-copper font-heading px-3 py-1 hover:bg-accent-copper hover:text-bg transition-colors"
                    >
                        ←
                    </button>
                    <div className="flex items-center gap-2">
                        {images.map((entry, dotIndex) => (
                            <button
                                key={entry.id}
                                onClick={() => setCurrentIndex(dotIndex)}
                                aria-label={`Show image ${dotIndex + 1} of ${images.length}`}
                                aria-current={dotIndex === index}
                                className={`h-2 w-2 rounded-full transition-colors ${dotIndex === index ? "bg-accent-copper" : "bg-hairline hover:bg-text-muted"}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={handleRight}
                        aria-label="Next image"
                        className="border border-hairline text-accent-copper font-heading px-3 py-1 hover:bg-accent-copper hover:text-bg transition-colors"
                    >
                        →
                    </button>
                </div>
            )}
            {image.sourceName && (
                <p className="font-body text-text-muted text-xs">
                    Image: {image.sourceUrl
                        ? <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-teal hover:underline">{image.sourceName}</a>
                        : image.sourceName}
                </p>
            )}
        </div>
    )
}

export default ImageCarousel