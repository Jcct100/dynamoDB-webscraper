const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const AWS = require("aws-sdk");
const fs = require("fs");
const dataJson = require("./data.json");

let awsConfig = {
  region: "eu-west-2",
  endpoint: "dynamodb.eu-west-2.amazonaws.com",
  accessKeyId: "accessKeyId",
  secretAccessKey: "secretAccessKey"
  };

AWS.config.update(awsConfig);
let docClient = new AWS.DynamoDB.DocumentClient();

let browser;
const allData = [];
let json;
let arrayHeaders;

async function scrapeHomesInIndexPage(url) {
  try {
    const page = await browser.newPage();
    await page.goto(url);
    const html = await page.evaluate(() => document.body.innerHTML);
    const $ = await cheerio.load(html);

    const homes = $(".tile a")
      .map(
        (i, element) => "https://principles.design" + $(element).attr("href")
      )
      .get();
    return homes;
  } catch (err) {
    console.error(errr);
  }
}

async function scrapeDescriptionPage(url, page) {
  try {
    await page.goto(url);
    const html = await page.evaluate(() => document.body.innerHTML);
    const $ = await cheerio.load(html);

    const title = $("body > main > div > div > header > h1").text();

    const author = $("body > main > div > div > aside > p:nth-child(1)")
      .text()
      .replace("Author:", " ");

    $("body > main > div > div > article > ol")
      .find("h2")
      .text((i, principles) => {
        const json = {
          title,
          author,
          principles
        };
        allData.push({ json });
      });
  } catch (err) {
    console.error(err);
  }
}

async function formatArray() {
  try {
    let allHeaders = [];

    allData.forEach((item, i) => {
      allHeaders.push(item.json.title);
    });

    const uniqueHeaders = new Set(allHeaders);
    arrayHeaders = [...uniqueHeaders];

    json = arrayHeaders.map(data => {
      return {
        header: data,
        authors: "",
        principles: []
      };
    });

    json.forEach(x =>
      allData.forEach(y => {
        if (x.header === y.json.title) {
          x.principles.push(y.json.principles);
          x.authors = y.json.author.replace(/\n/g, "");
        }
      })
    );
  } catch (err) {
    console.log("err", err);
  }
}

async function saveInDynamoDB() {
  let params = {
    TableName: "design-principles",
    Item: {
      UserId: "example@gmail.com",
      data: json
    }
  };

  docClient.put(params, function(err, data) {
    if (err) {
      console.log("users::save::error - " + JSON.stringify(err, null, 2));
    } else {
      console.log("users::save::sucess - ");
    }
  });
}

async function saveFileJson() {
  fs.writeFile("data.json", JSON.stringify(json, null, 4), function(err) {
    if (err) console.error(err);
    else console.log("Data Saved to data.json file");
  });
}

async function insertPrinciplesInDynamoDB() {
  try {
    dataJson.map(data => {
      const principleInDB = arrayHeaders.includes(data.header);

      if (!principleInDB) {
        await saveInDynamoDB();
      } else {
        console.log("dont save to DynamoDB");
      }
    });
  } catch (err) {
    console.log("err", err);
  }
}

async function main() {
  browser = await puppeteer.launch({ headless: false });
  const descriptionPage = await browser.newPage();
  const homes = await scrapeHomesInIndexPage(
    "https://principles.design/examples"
  );

  for (var i = 0; i < homes.length; i++) {
    await scrapeDescriptionPage(homes[i], descriptionPage);
  }

  await formatArray();

  await saveFileJson();

  await insertPrinciplesInDynamoDB();
}

main();
