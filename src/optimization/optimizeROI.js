'use strict';

const { levenbergMarquardt } = require('ml-levenberg-marquardt');
const { getShape1D } = require('ml-peak-shape-generator');
const { xMinMaxValues } = require('ml-spectra-processing');

const { DefaultParameters } = require('./DefaultParameters');
const { assert } = require('./assert');
const { directOptimization } = require('./directOptimization');

const properties = ['init', 'min', 'max', 'gradientDifference'];

const defaultLMOptimizationOptions = {
  damping: 1.5,
  maxIterations: 100,
  errorTolerance: 1e-8,
}

const defaultDirectOptimizationOptions = {
  iterations: 75,
}

module.exports = { optimizeROI, getInternalSignals, getSumOfShapes };

function optimizeROI(data, signals, options = {}) {
  const { optimization = {} } = options;
  let temp = xMinMaxValues(data.y);
  const minMaxY = { ...temp, range: temp.max - temp.min };

  const internalSignals = getInternalSignals(signals, minMaxY, options);

  const { baseline: shiftValue = minMaxY.min } = options;
  let normalizedY = new Float64Array(data.y.length);
  for (let i = 0; i < data.y.length; i++) {
    normalizedY[i] = (data.y[i] - shiftValue) / minMaxY.range;
  }

  const nbParams = internalSignals[internalSignals.length - 1].toIndex + 1;
  const minValues = new Float64Array(nbParams);
  const maxValues = new Float64Array(nbParams);
  const initialValues = new Float64Array(nbParams);
  const gradientDifferences = new Float64Array(nbParams);
  let index = 0;
  for (const peak of internalSignals) {
    for (let i = 0; i < peak.parameters.length; i++) {
      minValues[index] = peak.propertiesValues.min[i];
      maxValues[index] = peak.propertiesValues.max[i];
      initialValues[index] = peak.propertiesValues.init[i];
      gradientDifferences[index] = peak.propertiesValues.gradientDifference[i];
      index++;
    }
  }

  const sumOfShapes = getSumOfShapes(internalSignals);

  const { kind, options: optimizationOptions } = optimization;

  const [algorithm, defaultOptimizationOptions] = kind === 'direct'
    ? [directOptimization, defaultDirectOptimizationOptions]
    : [levenbergMarquardt, defaultLMOptimizationOptions]

  let fitted = algorithm({ x: data.x, y: normalizedY }, sumOfShapes, {
    minValues,
    maxValues,
    initialValues,
    gradientDifference: gradientDifferences,
    ...defaultOptimizationOptions,
    ...optimizationOptions
  });

  const fittedValues = fitted.parameterValues;

  let newSignals = [];
  for (let peak of internalSignals) {

    const newSignal = {
      x: 0,
      y: 0,
      shape: peak.shape,
      pattern: peak.pattern,
      parameters: peak.parameterOptions,
    };

    newSignal.x = fittedValues[peak.fromIndex];
    newSignal.y = fittedValues[peak.fromIndex + 1] * minMaxY.range + shiftValue;
    newSignal.coupling = fittedValues[peak.toIndex];
    for (let i = 2; i < peak.parameters.length - 1; i++) {
      //@ts-expect-error should be fixed once
      newSignal.shape[peak.parameters[i]] = fittedValues[peak.fromIndex + i];
    }

    newSignals.push(newSignal);
  }

  return newSignals;
}

/**
 * cuatro lineas que pueden variar de x;
 * dos intensidades uno para doblete;
 * dos parametros para asimetria del doblete;
 * cuatro parametros para width;
 */

function getSumOfShapes(internalSignals) {
  return function sumOfShapes(parameters) {
    return (currentX) => {
      let totalY = 0;
      for (const signal of internalSignals) {
        const delta = parameters[signal.fromIndex];
        const intensity = parameters[signal.fromIndex + 1];
        for (let i = 2; i <= signal.toIndex - 1; i++) {
          //@ts-expect-error Not simply to solve the issue
          signal.shapeFct[signal.parameters[i]] = parameters[signal.fromIndex + i];
        }
        const coupling = parameters[signal.toIndex];
        for (let peak of signal.pattern) {
          const { x, y } = peak;
          const halfCoupling = x / Math.abs(x) * coupling / 2;
          totalY += y * intensity * signal.shapeFct.fct(currentX - halfCoupling - delta);
        }
      }
      return totalY;
    };
  };
}

function getInternalSignals(
  peaks,
  minMaxY,
  options = {},
) {
  let index = 0;
  let internalPeaks = [];
  const { baseline: shiftValue = minMaxY.min } = options;

  const normalizedPeaks = peaks.map((peak) => {
    return {
      ...peak,
      y: (peak.y - shiftValue) / minMaxY.range,
    };
  });

  for (const peak of normalizedPeaks) {
    const shape = peak.shape
      ? peak.shape
      : options.shape
        ? options.shape
        : { kind: 'gaussian' };

    const shapeFct = getShape1D(shape);

    //@ts-expect-error Should disappear with next release of peak-shape-generator
    const parameters = ['x', 'y', ...shapeFct.getParameters()];

    if (peaks.some((peak) => ('coupling' in peak))) {
      parameters.push('coupling');
    }

    const propertiesValues = {
      min: [],
      max: [],
      init: [],
      gradientDifference: [],
    };

    for (let parameter of parameters) {
      for (let property of properties) {
        // check if the property is specified in the peak
        let propertyValue = peak?.parameters?.[parameter]?.[property];
        if (propertyValue) {
          propertyValue = getNormalizedValue(
            propertyValue,
            parameter,
            property,
            minMaxY,
            options.baseline,
          );

          propertiesValues[property].push(propertyValue);
          continue;
        }
        // check if there are some global option, it could be a number or a callback

        let generalParameterValue =
          options?.parameters?.[parameter]?.[property];
        if (generalParameterValue) {
          if (typeof generalParameterValue === 'number') {
            generalParameterValue = getNormalizedValue(
              generalParameterValue,
              parameter,
              property,
              minMaxY,
              options.baseline,
            );
            propertiesValues[property].push(generalParameterValue);
            continue;
          } else {
            let value = generalParameterValue(peak);
            value = getNormalizedValue(
              value,
              parameter,
              property,
              minMaxY,
              options.baseline,
            );
            propertiesValues[property].push(value);
            continue;
          }
        }

        // we just need to take the default parameters
        assert(
          DefaultParameters[parameter],
          `No default parameter for ${parameter}`,
        );
        const defaultParameterValues = DefaultParameters[parameter][property];
        //@ts-expect-error should never happen
        propertiesValues[property].push(defaultParameterValues(peak, shapeFct));
      }
    }

    const fromIndex = index;
    const toIndex = fromIndex + parameters.length - 1;
    index += toIndex - fromIndex + 1;

    internalPeaks.push({
      shape,
      shapeFct,
      pattern: peak.pattern || [{ x: 0, y: 1 }],
      coupling: peak.coupling,
      parameters,
      parameterOptions: peak.parameters,
      propertiesValues,
      fromIndex,
      toIndex,
    });
  }
  return internalPeaks;
}

function getNormalizedValue(
  value,
  parameter,
  property,
  minMaxY,
  baseline,
) {
  if (parameter === 'y') {
    if (property === 'gradientDifference') {
      return value;
    } else {
      return baseline !== undefined
        ? (value - baseline) / minMaxY.range
        : (value - minMaxY.min) / minMaxY.range;
    }
  }
  return value;
}