'use strict';

const { optimizeROI } = require('./optimization/optimizeROI');

const { writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
// const { argv } = require('yargs');
const { xyExtract, xMinMaxValues, xMedian } = require('ml-spectra-processing');
const { generateSpectrum } = require('spectrum-generator');
const { isAnyArray } = require('is-any-array');
const { xyAutoRangesPicking, xyAutoPeaksPicking, xyPeaksOptimization } = require('nmr-processing');
const { fileListFromPath } = require('filelist-utils');
const { convertFileList, groupByExperiments } = require('brukerconverter');
const { converterOptions, getName, paths } = require('./options');
const { getLorentzianArea, getPseudoVoigtArea } = require('ml-peak-shape-generator');
const exp = require('constants');

const line = `${new Array(40).fill('-').join('')}\n`;

(async () => {
  const pathToWrite = '/home/centos/tmsQuant';

  // const {
  //   path = join(__dirname, './data'),
  //   pathToWrite = join(__dirname, '../results'),
  // } = argv;

  if (!existsSync(pathToWrite)) {
    mkdirSync(pathToWrite);
  }

  for (const path of paths) {
    const fileList = fileListFromPath(path);
    //  For ANPC data run below
    const tempExperiments = groupByExperiments(fileList, converterOptions.filter);
    const experiments = tempExperiments.filter((exp) => exp.expno % 10 === 0);

    // for HEID transfer data run below
    // const tempExperiments = groupByExperiments(fileList, converterOptions.filter);
    // const experiments = tempExperiments.filter((exp) => exp.expno % 13 === 0);

    for (let i = 0; i < experiments.length; i++) {
      const data = (await convertFileList(experiments[i].fileList, converterOptions))[0];

      console.log(`${line}Data No.${i + 1} of ${experiments.length} \nSource: ${data.source.name}, expno: ${data.source.expno}`)

      const frequency = data.meta.SF;
      const name = getName(data);
      // const name = i; //for Heid timepoint ones
      let spectrum = data.spectra[0].data;
      if (spectrum.x[0] > spectrum.x[1]) {
        spectrum.x = spectrum.x.reverse();
        spectrum.re = spectrum.re.reverse();
      }

      const xyData = { x: spectrum.x, y: spectrum.re };

      process({ xyData, name, pathToWrite, frequency })
    }
  }
})()

function process(options) {
  const { xyData, name, pathToWrite, frequency } = options;

  // const fromTo = { from: 6.305, to: 6.326 };
  const fromTo = { from: -0.5, to: 0.5 }; // Changed to the eretic region
  const experimental = xyExtract(xyData, {
    zones: [fromTo],
  });

  const medianOfAll = xMedian(xyData.y);
  const medianOfROI = xMedian(xyExtract(xyData, {
    // zones: [{ from: 6.300, to: 6.330 }], // bigger reference range that covers all compounds
    zones: [{ from: 11.5, to: 12.5 }], // 

  }).y);

  //if (medianOfAll * 1.5 > medianOfROI) return;
  const peakList = xyAutoPeaksPicking(experimental, { frequency, minMax: 0.5, shape: { kind: 'pseudoVoigt' } });
  if (peakList.length === 0) {
    console.log("not found")
    return;
  }

  const biggestPeak = peakList.reduce((bigPeak, peak) => {
    return peak.y > bigPeak.y ? peak : bigPeak;
  }, { y: Number.MIN_SAFE_INTEGER });

  const peakLength = peakList.length;

  if (peakLength < 1) {
    console.log("too few")
    return;
  }
  const x1Limits = {
    min: biggestPeak.x - 0.01,
    max: biggestPeak.x + 0.01,
    gradientDifference: 0.0001
  }

  const minMaxY = xMinMaxValues(experimental.y);
  const range = minMaxY.max - minMaxY.min;
  minMaxY.range = range;
  const normalized = experimental.y.map((e) => e / range);
  const newPeaks = xyPeaksOptimization({ x: experimental.x, y: normalized }, [biggestPeak], {
    frequency,
    baseline: 0,
    shape: { kind: 'gaussian' },
    optimization: {
      kind: 'lm',
      options: {
        iterations: 20000,
      }
    }
  });

  const newSignals = newPeaks.map((peak, i, arr) => {
    const { shape } = arr[i];
    arr[i].y *= range;
    arr[i].shape.fwhm = shape.fwhm / frequency;
    arr[i].width = peak.width / frequency;

    const { x, y } = arr[i];
    const { fwhm, mu } = shape;
    const integration = getPseudoVoigtArea({ height: y, fwhm: fwhm / frequency, mu });
    return {
      x,
      y,
      coupling: 0,
      pattern: { x: 0, y: 1 },
      integration,
      shape
    }
  })

  const fit = generateSpectrum(newPeaks, { generator: { nbPoints: experimental.x.length, ...fromTo } })
  const residual = experimental.y.map((e, i) => e - fit.y[i]);
  writeFileSync(join(pathToWrite, `${name}_tms.json`), JSON.stringify([{
    name,
    expno: 'null',
    fit: [
      {
        roi: fromTo,
        fit: Array.from(fit.y),
        residual: Array.from(residual),
        peaks: [],
        optimizedPeaks: newPeaks,
        signals: newSignals
      }
    ],
    xyData: ensureArray(experimental),
    frequency
  }]));
}

function ensureArray(obj) {
  let result;
  if (isAnyArray(obj)) {
    result = obj.map((arr) => Array.from(arr));
  } else {
    result = {};
    for (let key in obj) {
      if (isAnyArray(obj[key])) {
        result[key] = Array.from(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }

  return result;
}

function getBiggestPeak(ranges) {
  let indices = { rangeIndex: -1, signalIndex: -1, peakIndex: -1 };
  let max = Number.MIN_SAFE_INTEGER;
  for (let i = 0; i < ranges.length; i++) {
    const signals = ranges[i].signals;
    for (let j = 0; j < signals.length; j++) {
      const peaks = signals[j].peaks;
      for (let k = 0; k < peaks.length; k++) {
        const peak = peaks[k];
        if (peak.y > max) {
          max = peak.y;
          indices =
            { rangeIndex: i, signalIndex: j, peakIndex: k }
        }
      }
    }
  }
  return indices;

}






