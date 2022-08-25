

const DefaultParameters = {
  x: {
    init: (peak) => peak.x,
    min: (peak, peakShape) =>
      peak.x - peakShape.fwhm * 2,
    max: (peak, peakShape) =>
      peak.x + peakShape.fwhm * 2,
    gradientDifference: (peak, peakShape) =>
      peakShape.fwhm * 2e-3,
  },
  y: {
    init: (peak) => peak.y,
    min: () => 0,
    max: () => 1.5,
    gradientDifference: () => 1e-3,
  },
  fwhm: {
    init: (peak, peakShape) => peakShape.fwhm,
    min: (peak, peakShape) => peakShape.fwhm * 0.25,
    max: (peak, peakShape) => peakShape.fwhm * 4,
    gradientDifference: (peak, peakShape) =>
      peakShape.fwhm * 2e-3,
  },
  mu: {
    init: (peak, peakShape) => peakShape.mu,
    min: () => 0,
    max: () => 1,
    gradientDifference: () => 0.01,
  },
  coupling: {
    init: (peak) => peak.coupling,
    min: (peak) => peak.coupling * 0.25,
    max: (peak) => peak.coupling * 4,
    gradientDifference: () => 0.000001,
  },
};

module.exports = { DefaultParameters }