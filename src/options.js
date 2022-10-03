

const { getName } = require('./utils/getName');
const { groupExperiments } = require('./utils/groupExperiments');

const process2DOptions = {
  zonesPicking: {
    tolerances: [5, 100],
    nuclei: ['1H', '1H'],
    realTopDetection: false,
  },
  jResAnalyzer: { reference: 0, getZones: true },
};

const gsdOptions = {
  minMaxRatio: 0.0005,
  broadRatio: 0.00025,
  smoothY: true,
  realTopDetection: true,
};

const converterOptions = {
  converter: { xy: true },
  filter: {
    //  experimentNumber: [10],
    onlyFirstProcessedData: true,
    ignoreFID: true,
    ignore2D: true,
  },
};

let optimizationOptions = {
  groupingFactor: 8,
  factorLimits: 2,
  shape: {
    kind: 'pseudoVoigt',
  },
  optimization: {
    kind: 'lm',
    parameters: {
      x: {
        max: (peak) => peak.x + peak.width * 2,
        min: (peak) => peak.x - peak.width * 2,
      },
      y: {
        max: () => 1.05,
      },
    },
    options: {
      maxIterations: 300,
    },
  },
};

const paths = [
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121'


  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121/10', // NA
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121/30', // Failed
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121/60', //NA
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/330',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/600',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/670',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/680',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/690',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/730',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/750',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/780',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/790',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp94_181121/800',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/70',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/110',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/160',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/230',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/270',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/300',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/370',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/390',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/410',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/480',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/680',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp95_181121/750',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/20',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/100',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/120',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/130',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/180',
  '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/260',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/290',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/320',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/380',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/400',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/410',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/430',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/440',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/450',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/490',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/500',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/510',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/520',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/530',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/560',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/590',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/630',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/650',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/660',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/670',
  // '/nmr/IVDR02/data/"covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/680', NA
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/690',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121/700'

        // VAX baseline (23)
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp21_200921/320',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp21_200921/420',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp21_200921/70',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp21_200921/740',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp21_200921/190',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/30',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/280',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/630',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/560',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/230',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/430',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/730',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/450',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/460',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/360',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/410',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/330',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/650',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/240',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/340',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/60',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/80',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/300'


  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp22_290921/',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp23_290921/',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp24_290921/',
  // '/nmr/IVDR04/data/covvac_C1_URI_NMR_URINE_IVDR04_VAXp25_290921/'
  // '/home/centos/TimeCurve'
  // '/home/centos/TimeCurve/Covid-SiFoUp_3mm_1',
  // '/nmr/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp93_181121/80',

]

let alignmentOptions = {
  // reference peaks is the pattern to use only relative intensity import
  referencePeaks: [
    { x: 0, y: 1 },
  ],
  // the expected delta of reference signal,
  delta: 0,
  // the region to make the PP and search the reference signal
  ppOptions: {
    from: -1,
    to: 1,
    // peak detection options
    minMaxRatio: 0.5,
    broadRatio: 0.00025,
    smoothY: true,
    realTopDetection: true,
    optimize: false,
    shape: { kind: 'lorentzian' },
    groupingFactor: 2.5,
  }
};

// alignment2D is succetible of changes
let alignment2DOptions = {
  // reference peaks is the pattern to use only relative intensity import
  referencePeaks: [
    { x: 0, y: 0 },
  ],
  // the expected delta of reference signal [x, y],
  delta: [0, 0],
  // the region to make the PP and search the reference signal
  fromTo: {
    x: { from: 5.1, to: 5.4 },
    y: { from: -0.001, to: 0.001 }
  }
  // peak detection options /TODO/
};

function getNameNormal(data) {
  const sourceName = data.source.name;
  const expno = data.source.expno;
  return `${sourceName}_${expno}`;
}

module.exports = {
  paths,
  getName: getName || getNameNormal,
  groupExperiments,
  alignmentOptions,
  alignment2DOptions,
  process2DOptions,
  gsdOptions,
  converterOptions,
  optimizationOptions
  ,
}