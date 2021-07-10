import * as React from "react";
import { DateTime } from "luxon";
import Highcharts from "highcharts";
import highchartsAnnotations from "highcharts/modules/annotations";
import HighchartsReact from "highcharts-react-official";
import merge from "lodash/merge";
import { useDebounce } from "../../utils/use-debounce";
import { useTranslations } from "../../utils/use-translation";
import {
  estimatedDailyFeeBurn,
  estimatedDailyIssuance,
  estimatedDailyStakeChange,
} from "../../utils/metric-utils";
import { useOnResize } from "../../utils/use-on-resize";
import { defaultOptions, COLORS } from "./chart-defaults";

import supplyData from "./supply-total.json";
import stakingData from "./supply-staking.json";
import contractData from "./supply-in-smart-contracts.json";

import styles from "./SupplyChart.module.scss";

interface Props {
  projectedStaking: number;
  projectedBaseGasPrice: number;
  projectedMergeDate: DateTime;
}

interface HighchartsRef {
  chart: Highcharts.Chart;
  container: React.RefObject<HTMLDivElement>;
}

if (typeof window !== "undefined") {
  highchartsAnnotations(Highcharts);
}

const intlFormatter = new Intl.NumberFormat();

const LONDON_DATE = DateTime.fromISO("2021-08-04T00:00:00Z");

let mouseOutTimer: NodeJS.Timeout | null = null;

const NUM_DAYS_PER_POINT = 7;

const COMPACT_MARKERS_BELOW_WIDTH = 1024;
const COMPACT_CHART_BELOW_WIDTH = 640;

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

const SupplyChart: React.FC<Props> = ({
  projectedBaseGasPrice,
  projectedStaking,
  projectedMergeDate,
}) => {
  const { translations: t } = useTranslations();
  React.useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: t.chart_thousands_sep,
        decimalPoint: t.chart_decimal_point,
      },
    });
  }, [t]);

  const chartRef = React.useRef<HighchartsRef | null>(null);
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  const handleChartMouseOut = React.useCallback(() => {
    clearTimeout(mouseOutTimer);
    mouseOutTimer = setTimeout(() => {
      setShowBreakdown(false);
    }, 200);
  }, []);

  const handleChartMouseOver = React.useCallback(() => {
    clearTimeout(mouseOutTimer);
    setShowBreakdown(true);
  }, []);

  const [useCompactMarkers, setUseCompactMarkers] = React.useState(
    typeof window !== "undefined" &&
      window.innerWidth < COMPACT_MARKERS_BELOW_WIDTH
  );
  const [useCompactChart, setUseCompactChart] = React.useState(
    typeof window !== "undefined" &&
      window.innerWidth < COMPACT_CHART_BELOW_WIDTH
  );

  useOnResize(({ width }) => {
    const _useCompactMarkers = width < COMPACT_MARKERS_BELOW_WIDTH;
    if (_useCompactMarkers !== useCompactMarkers) {
      setUseCompactMarkers(_useCompactMarkers);
    }
    const _useCompactChart = width < COMPACT_CHART_BELOW_WIDTH;
    if (_useCompactChart !== useCompactChart) {
      setUseCompactChart(_useCompactChart);
    }
  });

  const _chartSettings = React.useMemo(
    () => ({
      projectedBaseGasPrice,
      projectedStaking,
      projectedMergeDate,
      showBreakdown,
      useCompactChart,
      useCompactMarkers,
    }),
    [
      projectedBaseGasPrice,
      projectedStaking,
      projectedMergeDate,
      showBreakdown,
      useCompactChart,
      useCompactMarkers,
    ]
  );
  // Debounce how fast the chart settings can change to prevent UI from locking up
  const chartSettings = useDebounce(_chartSettings, 50);

  const markers = React.useMemo(
    // prettier-ignore
    (): [DateTime | null, string, string][] => ([
      [DateTime.fromISO("2015-07-31T00:00:00Z"), t.marker_genesis, `5 ETH/${t.marker_block}`],
      [DateTime.fromISO("2017-10-16T00:00:00Z"), "Byzantium", `3 ETH/${t.marker_block}`],
      [DateTime.fromISO("2019-02-27T00:00:00Z"), "Constantinople", `2 ETH/${t.marker_block}`],
      [DateTime.fromISO("2020-12-01T00:00:00Z"), t.marker_phase_0, t.marker_pos],
      [LONDON_DATE, "London", "EIP-1559"],
      [chartSettings.projectedMergeDate, t.marker_merge, t.marker_pow_removal],
    ]),
    [chartSettings, t]
  );

  const [series, annotations, totalSupplyByDate] = React.useMemo((): [
    Highcharts.SeriesOptionsType[],
    Highcharts.AnnotationsLabelsOptions[],
    Record<string, number>
  ] => {
    const stakingByDate = {};
    stakingData.forEach(({ t, v }) => {
      stakingByDate[t] = v;
    });

    const contractByDate = {};
    contractData.forEach(({ t, v }) => {
      contractByDate[t] = v;
    });

    const supplyByDate: Record<string, number> = {};

    const supplySeriesData: number[][] = [];
    const contractSeriesData: number[][] = [];
    const addressSeriesData: number[][] = [];
    const stakingSeriesData: number[][] = [];

    const numSupplyDataPoints = supplyData.length;

    let maxSupply: number | null = null;
    let peakSupply: [string, number] | null = null;

    supplyData.forEach(({ t: timestamp, v }, i) => {
      // Calculate peak supply
      if (v > (maxSupply || 0)) {
        maxSupply = v;
        peakSupply = null;
      } else if (v < maxSupply && !peakSupply) {
        peakSupply = [timestamp, v];
      }

      // Only render every Nth point for chart performance
      if (i % NUM_DAYS_PER_POINT !== 0 && i < numSupplyDataPoints - 1) {
        return;
      }

      // Subtract any staking eth from total supply on that date
      const stakingSupply = stakingByDate[timestamp] || 0;
      const nonStakingSupply = v - stakingSupply;

      const date = DateTime.fromISO(timestamp, { zone: "utc" });
      const dateMillis = date.toMillis();
      if (stakingByDate[timestamp]) {
        stakingSeriesData.push([dateMillis, stakingByDate[timestamp]]);
      }

      const inContractsPct = contractByDate[timestamp];
      let inAddressesValue = nonStakingSupply;
      if (inContractsPct !== undefined) {
        // Glassnode's ETH in contract data includes staked ETH, so we need
        // to subtract it here since we render staked ETH separately
        const inContractsValue = inContractsPct * v - stakingSupply;
        contractSeriesData.push([dateMillis, inContractsValue]);
        inAddressesValue -= inContractsValue;
      } else {
        contractSeriesData.push([dateMillis, 0]);
      }

      addressSeriesData.push([dateMillis, inAddressesValue]);
      supplySeriesData.push([dateMillis, v]);
      supplyByDate[dateMillis] = v;
    });

    const annotations: Highcharts.AnnotationsLabelsOptions[] = [];
    if (peakSupply) {
      const annotation: Highcharts.AnnotationsLabelsOptions = {
        point: {
          xAxis: 0,
          yAxis: 0,
          x: DateTime.fromISO(peakSupply[0], { zone: "utc" }).toMillis(),
          y: maxSupply,
        },
        text: `<div class="ann-root">
        <div class="ann-title">${t.peak_supply} 🦇🔉</div>
        <div class="ann-value">${Intl.NumberFormat(undefined, {
          maximumFractionDigits: 1,
        }).format(Math.round(peakSupply[1] / 1e5) / 10)}M ETH</div>
        </div>`,
        useHTML: true,
      };
      annotations.push(annotation);
    }

    // Projections
    const lastSupplyPoint = last(supplySeriesData);
    const lastStakingPoint = last(stakingSeriesData);
    const lastAddressPoint = last(addressSeriesData);
    const lastContractPoint = last(contractSeriesData);

    // Projection should be 1/3 of chart
    const firstDate = DateTime.fromISO(supplyData[0].t, { zone: "utc" });
    const lastDate = DateTime.fromISO(last(supplyData).t, { zone: "utc" });
    const daysOfData = lastDate.diff(firstDate, "days").days;
    const daysOfProjection = Math.floor(daysOfData / 2);

    const contractProj: number[][] = [lastContractPoint];
    const addressProj: number[][] = [lastAddressPoint];
    const stakingProj: number[][] = [lastStakingPoint];
    const supplyProj: number[][] = [lastSupplyPoint];
    const mergeDate = chartSettings.projectedMergeDate.toSeconds();

    let supplyValue = lastSupplyPoint[1];
    let stakingValue = lastStakingPoint[1];
    for (let i = 0; i < daysOfProjection; i++) {
      const projDate = lastDate.plus({ days: i + 1 }).startOf("day");

      // Calculate new ETH staking on this day
      if (stakingValue < chartSettings.projectedStaking) {
        // Add ETH to approach projected staking value
        stakingValue = Math.min(
          chartSettings.projectedStaking,
          stakingValue + estimatedDailyStakeChange(stakingValue)
        );
      } else if (stakingValue > chartSettings.projectedStaking) {
        // Subtract ETH to approach projected staking value
        stakingValue = Math.max(
          chartSettings.projectedStaking,
          stakingValue - estimatedDailyStakeChange(stakingValue)
        );
      }

      // Add in PoS issuance
      let newIssuance = estimatedDailyIssuance(stakingValue);
      // If this is berfore the merge, add PoW issuance
      if (projDate.toSeconds() < mergeDate) {
        newIssuance += 13500;
      }
      // If this is after EIP-1559 calculate the fee burn
      let burn = 0;
      if (projDate.toSeconds() >= LONDON_DATE.toSeconds()) {
        burn = estimatedDailyFeeBurn(chartSettings.projectedBaseGasPrice);
      }

      supplyValue = Math.max(supplyValue + newIssuance - burn, 0);

      // Only render every Nth point for chart performance
      if (i % NUM_DAYS_PER_POINT !== 0) {
        continue;
      }

      const nonStakingValue = Math.max(supplyValue - stakingValue, 0);

      let inContractValue = Math.min(lastContractPoint[1], nonStakingValue);
      let inAddressesValue = nonStakingValue - inContractValue;
      // Make sure ETH in addresses doesn't dip way below ETH in contracts
      if (inAddressesValue < inContractValue * 0.5) {
        inContractValue = Math.floor((nonStakingValue * 2) / 3);
        inAddressesValue = nonStakingValue - inContractValue;
      }

      // Make sure our total supply value can't dip below the amount staked
      const adjustedSupplyValue = Math.max(supplyValue, stakingValue);

      const projDateMillis = projDate.toMillis();
      contractProj.push([projDateMillis, inContractValue]);
      addressProj.push([projDateMillis, inAddressesValue]);
      stakingProj.push([projDateMillis, stakingValue]);
      supplyProj.push([projDateMillis, adjustedSupplyValue]);
      supplyByDate[projDateMillis] = adjustedSupplyValue;
    }

    const projSeriesOptions: Partial<Highcharts.SeriesAreaOptions> = {
      fillOpacity: 0.25,
      dashStyle: "Dash",
      showInLegend: false,
      marker: { symbol: "circle" },
    };

    let series: Highcharts.SeriesAreaOptions[] = [];
    const hiddenStyles: Partial<Highcharts.SeriesAreaOptions> = {
      opacity: 0,
      showInLegend: false,
    };
    const visibleStyles: Partial<Highcharts.SeriesAreaOptions> = {
      opacity: 1,
      showInLegend: true,
    };
    series = [
      {
        id: "supply",
        type: "area",
        name: t.historical_supply,
        color: COLORS.SERIES[0],
        data: supplySeriesData,
        enableMouseTracking: false,
        ...(chartSettings.showBreakdown ? hiddenStyles : visibleStyles),
      },
      {
        id: "supply_projected",
        type: "area",
        name: `${t.eth_supply} (${t.projected})`,
        data: supplyProj,
        color: COLORS.SERIES[0],
        enableMouseTracking: false,
        ...projSeriesOptions,
        showInLegend: true,
        ...(chartSettings.showBreakdown ? hiddenStyles : visibleStyles),
      },
      {
        id: "addresses",
        type: "area",
        name: t.supply_chart_series_address,
        color: COLORS.SERIES[1],
        data: addressSeriesData,
        marker: { symbol: "circle" },
        stack: "historical",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
      },
      {
        id: "contracts",
        type: "area",
        name: t.supply_chart_series_contracts,
        color: COLORS.SERIES[2],
        data: contractSeriesData,
        marker: { symbol: "circle" },
        stack: "historical",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
      },
      {
        id: "staking",
        type: "area",
        name: t.supply_chart_series_staking,
        color: COLORS.SERIES[5],
        data: stakingSeriesData,
        marker: { symbol: "circle" },
        stack: "historical",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
      },
      {
        id: "addresses_projected",
        type: "area",
        name: `${t.supply_chart_series_address} (${t.projected})`,
        data: addressProj,
        color: COLORS.SERIES[1],
        stack: "projected",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
        ...projSeriesOptions,
      },
      {
        id: "contracts_projected",
        type: "area",
        name: `${t.supply_chart_series_contracts} (${t.projected})`,
        data: contractProj,
        color: COLORS.SERIES[2],
        stack: "projected",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
        ...projSeriesOptions,
      },
      {
        id: "staking_projected",
        type: "area",
        name: `${t.supply_chart_series_staking} (${t.projected})`,
        data: stakingProj,
        color: COLORS.SERIES[5],
        stack: "projected",
        ...(chartSettings.showBreakdown ? visibleStyles : hiddenStyles),
        ...projSeriesOptions,
      },
    ];

    return [series, annotations, supplyByDate];
  }, [chartSettings, t]);

  const options = React.useMemo((): Highcharts.Options => {
    // Animate only if we're changing the underlying data & not the number of series
    const animate = Boolean(
      chartRef.current && series.length === chartRef.current.chart.series.length
    );

    const chartOptions: Highcharts.Options = {
      annotations: [
        {
          draggable: "",
          labelOptions: {
            backgroundColor: "#293350",
            borderWidth: 0,
            verticalAlign: "bottom",
            y: -7,
          },
          labels: annotations,
        },
      ],
      chart: {
        animation: animate,
        height: chartSettings.useCompactChart ? 300 : 380,
      },
      plotOptions: {
        area: {
          animation: animate,
          events: {
            mouseOver: handleChartMouseOver,
            mouseOut: handleChartMouseOut,
          },
        },
      },
      legend: {
        // Usinga custom legend for more control over responsiveness
        enabled: false,
      },
      series,
      xAxis: {
        type: "datetime",
        minPadding: 0,
        maxPadding: 0,
        tickInterval: 365.25 * 24 * 3600 * 1000, // always use 1 year intervals
        plotLines: markers.map(([date, title, subtitle], i) => ({
          value: date.toMillis(),
          color: COLORS.LABEL,
          width: 1,
          label: {
            rotation: 0,
            text: chartSettings.useCompactMarkers
              ? String.fromCharCode(65 + i)
              : `${title}<br><b>${subtitle}</b>`,
            style: {
              color: "#fff",
              whiteSpace: "normal",
              fontSize: "11px",
            },
            y: 18,
          },
          zIndex: 3,
        })),
      },
      yAxis: {
        min: 0,
        max: 160e6,
        tickInterval: 20e6,
        title: {
          text: undefined,
        },
      },
      tooltip: {
        shared: true,
        valueDecimals: 0,
        xDateFormat: "%Y-%m-%d",
        useHTML: true,
        formatter: function () {
          let points = (this.points || []).slice(0);

          // Historical/projected overlap at current date; only show historical on that date
          if (points.length > 4) {
            points = points.filter(
              (p) => !p.series.userOptions.id.includes("projected")
            );
          }

          const isProjected = points[0].series.userOptions.id.includes(
            "projected"
          );

          const dt = DateTime.fromMillis(this.x, { zone: "utc" });
          const header = `<div class="tt-header"><div class="tt-header-date">${dt.toISODate()}</div>${
            isProjected
              ? `<div class="tt-header-projected">(${t.projected})</div>`
              : ""
          }</div>`;

          const rows = points.map(
            (p) =>
              `<tr>
              <td>
                <div class="tt-series">
                  <div class="tt-series-color" style="background-color:${
                    p.series.userOptions.color
                  }"></div>
                  <div class="tt-series-name">${
                    p.series.name.split(" (")[0]
                  }</div>
                </div>
              </td>
              <td>${intlFormatter.format(Math.round(p.y))} ETH</td>
              </tr>`
          );

          // Show total supply last
          const total = totalSupplyByDate[this.x];
          rows.push(
            `<tr class="tt-total-row">
              <td><div class="tt-series-name">${t.total_supply}</div></td>
              <td>${intlFormatter.format(Math.round(total))} ETH</td>
            </tr>`
          );

          const table = `<table><tbody>${rows.join("")}</tbody></table>`;
          return `<div class="tt-root">${header}${table}</div>`;
        },
      },
    };
    return merge({}, defaultOptions, chartOptions);
  }, [
    annotations,
    handleChartMouseOver,
    handleChartMouseOut,
    markers,
    series,
    t,
    totalSupplyByDate,
    chartSettings,
  ]);

  const legendItems = series.filter((s) => s.showInLegend);

  return (
    <>
      <div className={styles.supplyChart}>
        <HighchartsReact
          options={options}
          highcharts={Highcharts}
          ref={chartRef}
        />
        <div className={styles.legend}>
          {legendItems.map((s) => (
            <div key={s.id} className={styles.legendItem}>
              <div
                className={styles.legendItemColor}
                style={{
                  backgroundColor: String(s.color),
                  opacity: (s as Highcharts.SeriesAreaOptions).fillOpacity,
                }}
              />
              <div
                className={styles.legendItemName}
                style={{ color: COLORS.LABEL }}
              >
                {s.id === "supply_projected" ? t.projected_supply : s.name}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.markerLegend}>
          {markers.map(([, title, subtitle], i) => (
            <div key={title} className={styles.markerLegendItem}>
              <div className={styles.markerLegendCount}>
                {String.fromCharCode(65 + i)}
              </div>
              <div>
                <div className={styles.markerLegendTitle}>{title}</div>
                <div className={styles.markerLegendSubtitle}>{subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default React.memo(SupplyChart);
