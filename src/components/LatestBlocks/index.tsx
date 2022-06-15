import * as DateFns from "date-fns";
import { flow } from "lodash";
import React, { FC, useContext, useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { TransitionGroup } from "react-transition-group";
import { useBlockLag } from "../../api/block-lag";
import { LatestBlock, useGroupedStats1 } from "../../api/grouped-stats-1";
import { Unit } from "../../denomination";
import { FeatureFlagsContext } from "../../feature-flags";
import * as Format from "../../format";
import { NEA, O, OAlt, pipe } from "../../fp";
import scrollbarStyles from "../../styles/Scrollbar.module.scss";
import { useActiveBreakpoint } from "../../utils/use-active-breakpoint";
import CSSTransition from "../CSSTransition";
import { AmountUnitSpace } from "../Spacing";
import { TextInter, TextRoboto } from "../Texts";
import { WidgetBackground, WidgetTitle } from "../widget-subcomponents";
import styles from "./LatestBlocks.module.scss";

const maxBlocks = 20;

const formatGas = flow(
  OAlt.numberFromUnknown,
  O.map(Format.gweiFromWei),
  O.map(Format.formatZeroDigit),
  O.toUndefined,
);

const formatFees = (unit: Unit, fees: unknown, feesUsd: unknown) =>
  unit === "eth"
    ? pipe(
        fees,
        OAlt.numberFromUnknown,
        O.map(Format.formatWeiTwoDigit),
        O.toUndefined,
      )
    : pipe(
        feesUsd,
        OAlt.numberFromUnknown,
        O.map((feesUsd) => `${Format.formatZeroDigit(feesUsd)}`),
        O.toUndefined,
      );

const formatTimeElapsed = (num: number | undefined) =>
  pipe(
    num,
    O.fromNullable,
    O.map((num: number) => `${num}s`),
    O.toUndefined,
  );

export const formatBlockNumber = (number: unknown) =>
  pipe(
    number,
    O.fromPredicate(
      (unknown): unknown is number => typeof unknown === "number",
    ),
    O.map(Format.formatNoDigit),
    O.map((str) => `#${str}`),
    O.toUndefined,
  );

const latestBlockFeesSkeletons = new Array(maxBlocks).fill(
  {},
) as Partial<LatestBlock>[];

type Props = { unit: Unit };

const LatestBlocks: FC<Props> = ({ unit }) => {
  const latestBlockFees = useGroupedStats1()?.latestBlockFees;
  const blockLag = useBlockLag()?.blockLag;
  const [timeElapsed, setTimeElapsed] = useState<number>();
  const { md } = useActiveBreakpoint();

  useEffect(() => {
    if (latestBlockFees === undefined) {
      return;
    }

    const latestMinedBlockDate = new Date(NEA.head(latestBlockFees).minedAt);

    setTimeElapsed(
      DateFns.differenceInSeconds(new Date(), latestMinedBlockDate),
    );

    const intervalId = window.setInterval(() => {
      setTimeElapsed(
        DateFns.differenceInSeconds(new Date(), latestMinedBlockDate),
      );
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [latestBlockFees]);

  const { previewSkeletons } = useContext(FeatureFlagsContext);

  return (
    <WidgetBackground>
      <div className="flex flex-col gap-y-4">
        <div className="grid grid-cols-3">
          <WidgetTitle>block</WidgetTitle>
          <WidgetTitle className="text-right">gas</WidgetTitle>
          <WidgetTitle className="text-right -mr-1">burn</WidgetTitle>
        </div>
        <ul
          className={`
            flex flex-col gap-y-4
            max-h-[184px] md:max-h-[209px] overflow-y-auto
            pr-1 -mr-3
            ${scrollbarStyles["styled-scrollbar"]}
          `}
        >
          <TransitionGroup
            component={null}
            appear={true}
            enter={true}
            exit={false}
          >
            {(latestBlockFees === undefined || previewSkeletons
              ? latestBlockFeesSkeletons
              : latestBlockFees
            ).map(({ number, fees, feesUsd, baseFeePerGas }, index) => (
              <CSSTransition
                classNames={{ ...styles }}
                timeout={2000}
                key={number || index}
              >
                <div className="transition-opacity duration-700 font-light text-base md:text-lg">
                  <a
                    href={
                      number === undefined
                        ? undefined
                        : `https://etherscan.io/block/${number}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <li className="grid grid-cols-3 hover:opacity-60">
                      <span className="font-roboto text-white">
                        {formatBlockNumber(number) || (
                          <Skeleton inline={true} width="7rem" />
                        )}
                      </span>
                      <div className="text-right mr-1">
                        <TextRoboto className="font-roboto text-white">
                          {formatGas(baseFeePerGas) || (
                            <Skeleton
                              className="-mr-0.5 md:mr-0"
                              inline={true}
                              width="1rem"
                            />
                          )}
                        </TextRoboto>
                        {md && (
                          <>
                            <span className="font-inter">&thinsp;</span>
                            <span className="font-roboto text-blue-spindle font-extralight">
                              Gwei
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <TextRoboto className="font-roboto text-white">
                          {formatFees(unit, fees, feesUsd) || (
                            <Skeleton inline={true} width="2rem" />
                          )}
                        </TextRoboto>
                        <AmountUnitSpace />
                        <span className="font-roboto text-blue-spindle font-extralight">
                          {unit === "eth" ? "ETH" : "USD"}
                        </span>
                      </div>
                    </li>
                  </a>
                </div>
              </CSSTransition>
            ))}
          </TransitionGroup>
        </ul>
        {/* spaces need to stay on the font-inter element to keep them consistent */}
        <span className="font-inter text-blue-spindle text-xs md:text-sm font-extralight">
          {"latest block "}
          <span className="font-roboto text-white font-light">
            {formatTimeElapsed(timeElapsed) === undefined ||
            previewSkeletons ? (
              <Skeleton inline={true} width="2rem" />
            ) : (
              formatTimeElapsed(timeElapsed)
            )}
          </span>
          {" old, "}
          <span className="font-roboto text-white font-light">
            {blockLag === undefined || previewSkeletons ? (
              <Skeleton inline={true} width="1rem" />
            ) : (
              blockLag
            )}
          </span>
          {" block lag"}
        </span>
        {typeof timeElapsed === "number" && timeElapsed > 1800 ? (
          <TextInter className="text-xs md:text-sm text-red-400">
            {"node failed, busy resyncing..."}
          </TextInter>
        ) : null}
      </div>
    </WidgetBackground>
  );
};

export default LatestBlocks;
