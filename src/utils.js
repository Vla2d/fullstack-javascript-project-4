import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import axios from 'axios';

const slugifyUrl = (url) => {
  const { pathname, hostname } = url;
  const name = path.join(hostname, pathname);

  return name.replace(/[^\w]/g, '-');
};

const slugifyFileName = (url) => {
  const { pathname, origin } = url;
  const { ext, dir, name } = path.parse(pathname);
  const urlWithoutExt = new URL(path.join(dir, name), origin);
  const slugifiedUrl = slugifyUrl(urlWithoutExt);
  const fileExtension = ext || '.html';

  return `${slugifiedUrl}${fileExtension}`;
};

const slugifyDirName = (url) => {
  const slugifiedUrl = slugifyUrl(url);

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
    .flatMap(([tagName, attribute]) => {
      const assetData = $(`${tagName}[${attribute}]`)
        .toArray()
        .map((element) => {
          const $element = $(element);
          const src = $element.attr(attribute);
          const assetUrl = new URL(src, origin);
          const name = slugifyFileName(assetUrl);

          return {
            $element, assetUrl, attribute, name,
          };
        });

      return assetData;
    })
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

const writeFile = (filePath, content) => fs.writeFile(filePath, content, { encoding: 'utf-8' });

const downloadAsset = (pageUrl, assetPath) => axios
  .get(pageUrl, { responseType: 'arraybuffer' })
  .then((response) => writeFile(assetPath, response.data));

export {
  slugifyDirName,
  slugifyFileName,
  extractAssets,
  writeFile,
  downloadAsset,
};
