require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
let bodyParser = require("body-parser");
let dns = require("dns");
let mongoose = require("mongoose");

mongoose.connect(process.env["MONGO_URI"], {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'urlshortner',
});

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

const urlSchema = new mongoose.Schema({
  shortUrl: Number,
  originalUrl: String,
});

let UrlModel = mongoose.model("UrlSchema", urlSchema);

const errorObj = { error: "invalid url" };

const checkUrl = (url, cb) => {
  const parsedUrl = url.replace(/(^\w+:|^)\/\//, '')
  console.log(parsedUrl)
  dns.lookup(
    parsedUrl,
    {
      family: 6,
    },
    (err) => {
      if (err) return cb(false);
      cb(true);
    },
  );
};

const getLastRecord = (done) => {
  UrlModel.find()
    .sort({ shortUrl: -1 })
    .limit(1)
    .exec(function (err, data) {
      if (err) return done(err);
      done(null, data);
    });
};

const getUrlByShortUrl = (shortUrl, done) => {
  UrlModel.find({ shortUrl })
    .exec(function (err, data) {
      if (err) return done(err);
      done(null, data);
    });
}

const createAndSaveUrl = (originalUrl, shortUrl, done) => {
  let urlM = new UrlModel({
    originalUrl,
    shortUrl
  })
  urlM.save(function (err, data) {
    if (err) return done(err);
    done(null, data);
  })
};

const shortner = (req, res) => {
  const url = req.body?.url
  if (!url) return res.json(errorObj);
  checkUrl(url, (dnsRes) => {
    if (!dnsRes) return res.json(errorObj);
    getLastRecord((err, data) => {
      if (err) return res.json({ error: 'something went wrong' })
      if (data?.length) {
        const short_url = Number(data[0].shortUrl) + 1
        createAndSaveUrl(url, short_url, (errC, dataC) => {
          if (errC) return res.json({ error: 'something went wrong' })
          return res.json({ original_url: url, short_url })
        })
      } else {
        // create very first url
        createAndSaveUrl(url, 1, (errC) => {
          if (errC) return res.json({ error: 'something went wrong' })
          return res.json({ original_url: url, short_url: 1 })
        })
      }
    });
  });
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// API endpoint for redirect to original url
app.get("/api/shorturl/:code", function (req, res) {
  const shortUrl = req.params?.code
  if (!shortUrl) return res.json({ error: 'something went wrong' })
  getUrlByShortUrl(shortUrl, (err, data) => {
    if (err) return res.json({ error: 'something went wrong' })
    if (!data?.length) return res.json({ error: 'Not found' })
    res.status(301).redirect(data[0].originalUrl)
    return 1
  })
});

// API endpoint for shortner
app.post("/api/shorturl", shortner);

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
