# pipe-doublets-deconvolution

Deconvolution of two overlaped doublets. Currently it is a not a general purpose package.

## Usage

Clone the project, enter the directory and run:

```bash
node src/index.js --path 'path-to-data' --pathToWrite 'path to write the results'
```

it will write a json file peer experiments with the next structure.

```js
{
  roi: { from: number, to: number },
  fit: Array<number>,
  residual: Array<number>,
  optimizedPeaks: Array<Peak>,
  signals: Array<Signal>,
}
```
It is possible to visualize the results by drag and drop the json files in [the view](https://my.cheminfo.org/?viewURL=https%3A%2F%2Fmydb.cheminfo.org%2Fdb%2Fvisualizer%2Fentry%2Fa65df02478ae2628fb501cf83bb3eec2%2Fview.json)

## License

[MIT](./LICENSE)
