import type { BaseFeePerGasStats } from "../api/base-fee-per-gas-stats";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import { WidgetBackground } from "./WidgetSubcomponents";
import LabelText from "./TextsNext/LabelText";
import TimeFrameIndicator from "./TimeFrameIndicator";
import type { FC } from "react";
import QuantifyText from "./TextsNext/QuantifyText";
import SkeletonText from "./TextsNext/SkeletonText";
import { formatZeroDecimals } from "../format";
import { WEI_PER_GWEI } from "../eth-units";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import batSvg from "../assets/bat-own.svg";
import speakerSvg from "../assets/speaker-own.svg";
import barrierSvg from "../assets/barrier-own.svg";

const getPercentage = (
  highest: number,
  lowest: number,
  gas: number,
): number => {
  const range = highest - lowest;
  return (gas - lowest) / range;
};

type MarkerProps = {
  emphasize: boolean;
  gas: number;
  highest: number;
  label: string;
  lowest: number;
  orientation: "up" | "down";
};

const Marker: FC<MarkerProps> = ({
  emphasize,
  gas,
  highest,
  label,
  lowest,
  orientation,
}) => (
  <div
    className={`
        absolute  -translate-x-1/2
        flex flex-col items-center
        ${orientation === "up" ? "-top-14" : "-bottom-14"}
        ${emphasize ? "" : "opacity-60"}
        ${label === "barrier-max" || label === "barrier-min" ? "invisible" : ""}
      `}
    style={{
      left: `${getPercentage(highest, lowest, gas) * 100}%`,
    }}
  >
    {orientation === "down" && (<div className={`w-0.5 ${emphasize ? "h-4" : "h-2"} bg-slateus-200 rounded-b-full mb-2`}></div>)}
    {label === "barrier" ? (
      <>
        <div className="flex gap-x-1">
          <Image
            alt="emoji of a bat, first-half of signifying ultra sound base fee per gas"
            src={batSvg as StaticImageData}
            width={16}
            height={16}
          />
          <Image
            alt="emoji of a speaker, second-half of signifying ultra sound base fee per gas"
            src={speakerSvg as StaticImageData}
            width={16}
            height={16}
          />
          <Image
            alt="emoji of a barrier, third-half of signifying ultra sound base fee per gas"
            src={barrierSvg as StaticImageData}
            width={16}
            height={16}
          />
        </div>
      </>
    ) : (
      <LabelText>{label}</LabelText>
    )}
    <SkeletonText>
      {gas !== undefined && (
        <QuantifyText unitPostfix="Gwei">
          {formatZeroDecimals(gas / WEI_PER_GWEI)}
        </QuantifyText>
      )}
    </SkeletonText>
    {orientation === "up" && <div className={`w-0.5 ${emphasize ? "h-4" : "h-2"} bg-slateus-200 rounded-t-full mt-2`}></div>}
  </div>
);

type Props = {
  baseFeePerGasStats: BaseFeePerGasStats | undefined;
};

const GasMarketWidget: FC<Props> = ({ baseFeePerGasStats }) => {
  const lowest = 0;

  const highest =
    baseFeePerGasStats === undefined
      ? undefined
      : Math.max(baseFeePerGasStats.max, baseFeePerGasStats.barrier) * 1.1;

  const markerList =
    baseFeePerGasStats === undefined
      ? []
      : [
        { label: "barrier", gas: baseFeePerGasStats.barrier, emphasize: true },
        { label: "min", gas: baseFeePerGasStats.min, emphasize: false },
        { label: "max", gas: baseFeePerGasStats.max, emphasize: false },
        { label: "average", gas: baseFeePerGasStats.average, emphasize: true },
      ].sort(({ gas: gasA }, { gas: gasB }) => gasA - gasB);

  const gasRange =
    highest === undefined || lowest === undefined
      ? undefined
      : highest - lowest;

  const averagePercent =
    baseFeePerGasStats === undefined ||
      gasRange === undefined ||
      lowest === undefined
      ? undefined
      : ((baseFeePerGasStats.average - lowest) / gasRange) * 100;

  const barrierPercent =
    baseFeePerGasStats === undefined ||
      gasRange === undefined ||
      lowest === undefined
      ? undefined
      : ((baseFeePerGasStats.barrier - lowest) / gasRange) * 100;

  const deltaPercent =
    barrierPercent !== undefined && averagePercent !== undefined
      ? averagePercent - barrierPercent
      : undefined;

  return (
    <WidgetErrorBoundary title="gas market">
      <WidgetBackground className="flex flex-col">
        <div className="flex justify-between">
          <LabelText>gas market</LabelText>
          <TimeFrameIndicator
            className="pointer-events-none"
            timeFrame="h1"
            onClickTimeFrame={() => undefined}
          />
        </div>
        <div
          className={`
            relative
            flex
            h-2
            my-16
            bg-blue-highlightbg
            rounded-full
          `}
        >
          {deltaPercent !== undefined && (
            <div
              className={` absolute bg-gradient-to-r ${deltaPercent >= 0
                ? "from-orange-400 to-yellow-500"
                : "to-indigo-500 from-cyan-300 "
                } h-2`}
              style={{
                left:
                  deltaPercent >= 0
                    ? `${barrierPercent}%`
                    : `${averagePercent}%`,
                width: `${Math.abs(deltaPercent)}%`,
              }}
            ></div>
          )}

          {markerList !== undefined &&
            highest !== undefined &&
            lowest !== undefined &&
            markerList.map(({ label, gas, emphasize }, index) => (
              <Marker
                highest={highest}
                lowest={lowest}
                key={label}
                label={label}
                gas={gas}
                orientation={index % 2 === 0 ? "up" : "down"}
                emphasize={emphasize}
              />
            ))}
        </div>
      </WidgetBackground>
    </WidgetErrorBoundary>
  );
};

export default GasMarketWidget;
