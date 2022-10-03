'use strict';

const { optimizeROI } = require('./optimization/optimizeROI');

const { writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
// const { argv } = require('yargs');
const { xyExtract, xMinMaxValues, xMedian } = require('ml-spectra-processing');
const { generateSpectrum } = require('spectrum-generator');
const { isAnyArray } = require('is-any-array');
const { xyAutoRangesPicking } = require('nmr-processing');
const { fileListFromPath } = require('filelist-utils');
const { convertFileList, groupByExperiments } = require('brukerconverter');
const { converterOptions, getName } = require('./options');
const { getLorentzianArea, getPseudoVoigtArea } = require('ml-peak-shape-generator');

const line = `${new Array(40).fill('-').join('')}\n`;

(async () => {
  const path = '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121';
  // const path = '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121';
//   const path = '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121';
  
  // let path = '/home/abolanos/spectraTest/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121';
  const pathToWrite = '/home/centos/testTest';

  // const {
  //   path = join(__dirname, './data'),
  //   pathToWrite = join(__dirname, '../results'),
  // } = argv;

  if (!existsSync(pathToWrite)) {
    mkdirSync(pathToWrite);
  }

  const fileList = fileListFromPath(path);

  const tempExperiments = groupByExperiments(fileList, converterOptions.filter);
  // const tempExperiments = groupByExperiments(fileList);
  const experiments = tempExperiments.filter((exp) => exp.expno % 10 === 0);
  // const experiments = tempExperiments; //tempExperiments.filter((exp) => exp.expno % 10 === 0);
  //console.log(experiments);
  
  for (let i = 0; i < experiments.length; i++) {
    const data = (await convertFileList(experiments[i].fileList, converterOptions))[0];

    console.log(`${line}Data No.${i + 1} of ${experiments.length} \nSource: ${data.source.name}, expno: ${data.source.expno}`)

    const frequency = data.meta.SF;
    const name = getName(data);
    // const name = i; for Heid timepoint ones
    let spectrum = data.spectra[0].data;
    if (spectrum.x[0] > spectrum.x[1]) {
      spectrum.x = spectrum.x.reverse();
      spectrum.re = spectrum.re.reverse();
    }

    const xyData = { x: spectrum.x, y: spectrum.re };

    process({ xyData, name, pathToWrite, frequency })
  }
})()

function process(options) {
  const { xyData, name, pathToWrite, frequency } = options;

  const fromTo = { from: 11.95, to: 12.05 };

  const experimental = xyExtract(xyData, {
    zones: [fromTo],
  });

  const medianOfAll = xMedian(xyData.y);
  const medianOfROI = xMedian(xyExtract(xyData, {
    zones: [{ from: 11.8, to: 12.2 }], // bigger reference range that covers all compounds
  }).y);

  //if (medianOfAll * 1.5 > medianOfROI) return;
  const ranges = xyAutoRangesPicking(experimental, { peakPicking: { frequency }, ranges: { keepPeaks: true, compile: false, joinOverlapRanges: false, frequencyCluster: 16 } });
  if (ranges.length === 0) {
    console.log("not found")
    return;
  }

  const { rangeIndex, signalIndex, peakIndex } = getBiggestPeak(ranges);

  const peaksCloseToBiggest = ranges[rangeIndex].signals[signalIndex].peaks
  const biggestPeak = ranges[rangeIndex]?.signals[signalIndex]?.peaks[peakIndex];
  const peakLength = ranges[rangeIndex].signals[signalIndex].peaks.length;
  console.log(peakLength, ranges[rangeIndex].signals[signalIndex]);
  if (peakLength > 1) {
    console.log("too many")
    return;
  }
  const x1Limits = {
    min: ranges[rangeIndex].signals[signalIndex].delta - 0.01,
    max: ranges[rangeIndex].signals[signalIndex].delta + 0.01,
    gradientDifference: 0.0001
  }

  const minMaxY = xMinMaxValues(experimental.y);
  const range = minMaxY.max - minMaxY.min;
  minMaxY.range = range;
  const normalized = experimental.y.map((e) => e / range);

  const js = 0 / frequency; // in ppm
  // const widthGuess = 0.97 / frequency; //in ppm
  const widthGuess = 0.011 / frequency; //in ppm
  const signals = [
    {
      x: 12.0 ,  
      y: 1,
      //   coupling: js,
      pattern: { x: 12.0, y: 1 },
      parameters: {
        x: x1Limits,
        y: {
          min: 0,
          max: 1,
          gradientDifference: 0.001
        },
        fwhm: {
          min: widthGuess / 2,
          max: widthGuess * 1.2,
        },
        coupling: {
          min: js * 0.8,
          max: js * 1.2,
        }
      }
    },
  ];
  const tempSignals = optimizeROI({ x: experimental.x, y: normalized }, signals, {
    baseline: 0,
    shape: { kind: 'gaussian' },
    optimization: {
      kind: 'direct',
      options: {
        iterations: 5,
      }
    }
  });
  tempSignals.forEach((signal, i, arr) => {
    const fwhm = signal.shape.fwhm;
    arr[i].shape = {
      kind: 'pseudoVoigt',
      fwhm,
      mu: 0,
    }
  });
  const newSignals = optimizeROI({ x: experimental.x, y: normalized }, tempSignals, {
    baseline: 0,
    optimization: {
      kind: 'lm',
      options: {
        maxIterations: 10,
      }
    }
  });

  const peaks = newSignals.flatMap((signal, i) => {
    const { x: delta, y: intensity, coupling, pattern } = signal;
    delete signal.pattern;
    // const halfCoupling = coupling / 2;

    return pattern.map((peak) => {
      const { x, y } = peak;
      return {
        ...signal,
        // x: delta + (x / Math.abs(x) * halfCoupling),
        x: delta + (x / Math.abs(x) * halfCoupling),
        y: intensity * y,
      }
    })
  })

  peaks.forEach((peak, i, arr) => {
    arr[i].y *= range;
  })

  newSignals.forEach((_, i, arr) => {
    arr[i].y *= range;
  });

  const fit = generateSpectrum(peaks, { generator: { nbPoints: experimental.x.length, ...fromTo } })
  const residual = experimental.y.map((e, i) => e - fit.y[i]);
  writeFileSync(join(pathToWrite, `${name}_FIT.json`), JSON.stringify([{
    name,
    expno: 'null',
    fit: [
      {
        roi: fromTo,
        fit: Array.from(fit.y),
        residual: Array.from(residual),
        peaks: [],
        optimizedPeaks: peaks,
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






