import type { StaticImageData } from "next/image";
import { FC, RefObject, useEffect } from "react";
import { useCallback, useContext, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import questionMarkSvg from "../assets/question-mark-v2.svg";
import { FeatureFlagsContext } from "../feature-flags";
import styles from "./ImageWithOnClickTooltip.module.scss";
import properties from '../../public/sprite/properties.json'

const sizeFactor = 8; // (from 96px to 12px)

type ImageWithOnClickTooltipProps = {
  className?: HTMLImageElement["className"];
  imageUrl: string | undefined;
  handle: string | undefined;
  isDoneLoading?: boolean;
  onClick: (ref: RefObject<HTMLImageElement>) => void;
  skeletonDiameter?: string;
  currentScale: number | undefined;
  getXAndY: (imageKey: string | undefined, sizeFactor: number) => { x: number | null, y: number | null };
  excluded?: boolean;
};

const ImageWithOnClickTooltip: FC<ImageWithOnClickTooltipProps> = ({
  className = "",
  imageUrl,
  handle,
  isDoneLoading = true,
  onClick,
  currentScale,
  getXAndY,
  excluded = false,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const { previewSkeletons } = useContext(FeatureFlagsContext);
  const [imgSrc, setImgSrc] = useState<string | StaticImageData | undefined>(
    imageUrl,
  );
  const [posX, setPosX] = useState<number | null>(null);
  const [posY, setPosY] = useState<number | null>(null);

  const onImageError = useCallback(() => {
    setImgSrc(questionMarkSvg as StaticImageData);
  }, []);

  useEffect(() => {
    if (imageUrl !== undefined && getXAndY) {
      const { x, y } = getXAndY(imageUrl, sizeFactor);
      setPosX(x);
      setPosY(y);
    }
  }, [getXAndY, imageUrl]);

  return (
    <>
      {!isDoneLoading || previewSkeletons || posX === null || posY === null ? (
        <div className={`relative rounded-full ${className}`}>
        <Skeleton
          circle
          inline
          className="!leading-3 flex"
        />
        </div>
      ) : (
        <div
          id={handle?.toLowerCase()}
          ref={imageRef}
          // measure distance mouse moved since click if more than 10px, don't trigger onClick
          onMouseDown={(e) => {
            if (onClick === undefined || excluded) return;
            const { clientX, clientY } = e;
            let distanceMoved = 0;
            const onMouseMove = (e: MouseEvent) => {
              const { clientX: newClientX, clientY: newClientY } = e;
              distanceMoved += Math.abs(clientX - newClientX) + Math.abs(clientY - newClientY);
            };
            const onMouseUp = () => {
              if (distanceMoved < 10) {
                onClick(imageRef);
              }
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            };
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          }}
          // className={className}
          className={`
            ${styles["fam-image-sprite"]}
            ${excluded ? "cursor-move !brightness-[0.25]" : "cursor-pointer"}
            relative
            rounded-full
            md:hover:brightness-125
            ${className}
            handle-className-${handle?.toLowerCase()}
          `}
          style={{
            backgroundPositionX: `${posX}px`,
            backgroundPositionY: `${posY}px`,
            backgroundSize: `${properties?.width / sizeFactor}px ${properties?.height / sizeFactor}px`,
          }}
            // ${onMouseEnter !== undefined ? "hover:opacity-60" : ""}
        >
          {/* <Image
            className={`
              rounded-full active:brightness-125
              md:cursor-auto md:active:brightness-100
              `}
              // ${onMouseEnter !== undefined ? "hover:opacity-60" : ""}
            src={imgSrc ?? (questionMarkSvg as StaticImageData)}
            alt="logo of an ERC20 token"
            onError={onImageError}
            // onClick={onClick}
            quality={40}
            // sizes="(max-width: 640px) 100vw, 640px"
            fill
          /> */}
          {/* <div
            className={`
              rounded-full active:brightness-125
              md:cursor-auto md:active:brightness-100
              `}
              // ${onMouseEnter !== undefined ? "hover:opacity-60" : ""}
            onError={onImageError}
            // onClick={onClick}
            // sizes="(max-width: 640px) 100vw, 640px"
          /> */}
        </div>
      )}
    </>
  );
};

export default ImageWithOnClickTooltip;
