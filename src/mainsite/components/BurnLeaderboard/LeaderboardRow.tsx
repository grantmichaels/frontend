import type { FC, RefObject } from "react";
import { useContext } from "react";
import Skeleton from "react-loading-skeleton";
import type { CategoryId } from "../../api/burn-categories";
import {
  categoryDisplayMap,
  getIsKnownCategory,
} from "../../api/burn-categories";
import type * as Contracts from "../../api/contracts";
import type { LeaderboardEntry } from "../../api/leaderboards";
import type { Unit } from "../../../denomination";
import { FeatureFlagsContext } from "../../../feature-flags";
import * as Format from "../../../format";
import { QuantifyTextAnimated } from "../Amount";
import ImageWithTooltip from "../ImageWithTooltip";
import AdminControls from "../AdminControls";

type Props = {
  address?: string;
  adminToken?: string;
  category?: CategoryId | string | undefined;
  detail?: string;
  fees?: number;
  freshness?: Contracts.MetadataFreshness;
  onClickImage?: () => void;
  onMouseEnterImage?: (ref: RefObject<HTMLImageElement>) => void;
  onMouseLeaveImage?: () => void;
  tooltipDescirption?: string;
  image?: string | undefined;
  isBot?: boolean | undefined;
  name?: string;
  type?: LeaderboardEntry["type"];
  unit?: Unit;
};

const LeaderboardRow: FC<Props> = ({
  address,
  adminToken,
  category,
  detail,
  fees,
  freshness,
  onClickImage,
  onMouseLeaveImage,
  onMouseEnterImage,
  image,
  isBot,
  name,
  type,
  unit,
}) => {
  const { showCategorySlugs, showMetadataTools } =
    useContext(FeatureFlagsContext);

  const imgSrc =
    typeof image === "string"
      ? image
      : type === "eth-transfers"
      ? "/leaderboard-images/transfer-v2.svg"
      : isBot
      ? "/leaderboard-images/bot-v2.svg"
      : type === "contract-creations"
      ? "/leaderboard-images/contract-creations.svg"
      : undefined;

  const isDoneLoading = type !== undefined;

  return (
    <>
      <div className="pt-2.5 pr-2 pb-2.5">
        <div className="flex text-white">
          <ImageWithTooltip
            onMouseEnter={isBot ? undefined : onMouseEnterImage}
            onMouseLeave={onMouseLeaveImage}
            onClick={onClickImage}
            className="flex items-center rounded-full select-none"
            isDoneLoading={isDoneLoading}
            imageUrl={imgSrc}
            width={32}
            height={32}
          />
          <a
            className={`
              flex
              w-full flex-row items-center
              truncate font-inter
              text-base font-light text-white
              md:text-lg
              ${address !== undefined ? "hover:opacity-60" : ""}
            `}
            href={
              address === undefined
                ? undefined
                : `https://etherscan.io/address/${address}`
            }
            target="_blank"
            rel="noreferrer"
          >
            <p className="pl-4 truncate">
              {typeof name === "string" ? (
                name
              ) : typeof address === "string" ? (
                <span className="font-roboto">
                  {"0x" + address.slice(2, 6)}
                  <span className="font-inter">...</span>
                  {address.slice(38, 42)}
                </span>
              ) : (
                <Skeleton inline={true} width="12rem" />
              )}
            </p>
            <p
              className={`
                ml-2 hidden whitespace-nowrap
                rounded-sm bg-slateus-600
                px-1.5
                py-0.5
                text-sm
                font-normal
                text-slateus-400 md:block
                ${category ? "block" : "md:hidden"}
              `}
            >
              {showCategorySlugs
                ? category
                : getIsKnownCategory(category)
                ? categoryDisplayMap[category]
                : Format.capitalize(category)}
            </p>
            {detail && (
              <p className="hidden pl-2 font-extralight md:block lg:hidden xl:block truncate text-slateus-400">
                {detail}
              </p>
            )}
            <p className="pl-4 ml-auto whitespace-nowrap">
              {fees === undefined ? (
                <Skeleton inline={true} width="4rem" />
              ) : (
                <QuantifyTextAnimated
                  unit={unit || "eth"}
                  unitText={unit === "eth" ? "ETH" : "USD"}
                >
                  {fees}
                </QuantifyTextAnimated>
              )}
            </p>
          </a>
        </div>
        {adminToken !== undefined &&
          address !== undefined &&
          showMetadataTools && (
            <AdminControls address={address} freshness={freshness} />
          )}
      </div>
    </>
  );
};

export default LeaderboardRow;
