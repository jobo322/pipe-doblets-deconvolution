

const direct = require('ml-direct');

module.exports = { directOptimization }

function directOptimization(
  data,
  sumOfShapes,
  options,
) {
  const {
    minValues,
    maxValues,
    iterations,
    epsilon,
    tolerance,
    tolerance2,
    initialState,
  } = options;
  const objectiveFunction = getObjectiveFunction(data, sumOfShapes);
  const result = direct(objectiveFunction, minValues, maxValues, {
    iterations,
    epsilon,
    tolerance,
    tolerance2,
    initialState,
  });

  const { optima } = result;

  return {
    error: result.minFunctionValue,
    iterations: result.iterations,
    parameterValues: optima[0],
  };
}

function getObjectiveFunction(
  data,
  sumOfShapes,
) {
  const { x, y } = data;
  const nbPoints = x.length;
  return (parameters) => {
    const fct = sumOfShapes(parameters);
    let error = 0;
    for (let i = 0; i < nbPoints; i++) {
      error += Math.pow(y[i] - fct(x[i]), 2);
    }
    return error;
  };
}