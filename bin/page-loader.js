#!/usr/bin/env node
import program from 'commander';
import loadPage from '../src/index.js';

program
  .version('0.0.1')
  .description('Page loader utility.')
  .option('-o, --output [dir]', `output dir (default: "${process.cwd()}")`)
  .arguments('<url>')
  .action((pagepath, options) => {
    loadPage(pagepath, options.output)
      .then((pagePath) => console.log(pagePath))
      .catch(({ message, response }) => {
        const isClientError = !!((response.status > 400 && response.status < 500));
        console.error(`${message}. ${isClientError ? 'Client' : 'Server'} error.`);
        process.exit(1);
      });
  })
  .parse(process.argv);
