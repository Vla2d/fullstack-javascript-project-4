import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import axios from 'axios';

const slugifyUrl = (url) => url.replace(/\W+/g, '-').replace(/-+$/, '');

const transformUrlToFileName = (url) => {
  const { pathname, hostname } = url;
  const { ext, dir, name } = path.parse(pathname);
  const slugifiedUrl = slugifyUrl(`${hostname}/${dir}/${name}`);
  const fileExtension = ext || '.html';

  return `${slugifiedUrl}${fileExtension}`;
};

const transformUrlToDirName = (url) => {
  const { pathname, hostname } = url;
  const { dir, name } = path.parse(pathname);
  const slugifiedUrl = slugifyUrl(`${hostname}/${dir}/${name}`);

  return `${slugifiedUrl}_files`;
};

const extractAssets = (data, pageUrl, dirName) => {
  const tagsAttributes = {
    img: 'src',
    link: 'href',
    script: 'src',
  };

  const { origin } = pageUrl;
  const $ = cheerio.load(data);
  const assets = Object.entries(tagsAttributes)
    .flatMap(([tagName, attribute]) => $(`${tagName}[${attribute}]`)
      .toArray()
      .map((element) => {
        const $element = $(element);
        const src = $element.attr(attribute);
        const assetUrl = new URL(src, origin);
        const name = transformUrlToFileName(assetUrl);

        return {
          $element, assetUrl, attribute, name,
        };
      }))
    .filter(({ assetUrl }) => assetUrl.origin === origin)
    .map(({
      $element, assetUrl, attribute, name,
    }) => {
      $element.attr(attribute, `${dirName}/${name}`);

      return { assetUrl, name };
    });

  const html = $.root().html();

  return { html, assets };
};

const writeFile = (filePath, content) => fs.writeFile(filePath, content);

const downloadAsset = (pageUrl, assetPath) => axios
  .get(pageUrl, { responseType: 'arraybuffer' })
  .then((response) => writeFile(assetPath, response.data));

export {
  transformUrlToDirName,
  transformUrlToFileName,
  extractAssets,
  writeFile,
  downloadAsset,
};
