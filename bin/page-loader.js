#!/usr/bin/env node
import program from 'commander';
import loadPage from '../src/index.js';

program
  .version('0.0.1')
  .description('Page loader utility.')
  .option('-o, --output [dir]', `output dir (default: "${process.cwd()}")`, process.cwd())
  .arguments('<url>')
  .action((pagepath, options) => {
    loadPage(pagepath, options.output)
      .then((pagePath) => console.log(`Page was successfully downloaded into '${pagePath}'`))
      .catch(({ message }) => {
        console.error(message);
        process.exit(1);
      });
  })
  .parse(process.argv);
