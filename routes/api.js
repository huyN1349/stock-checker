/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

/*
Get required data from website
Use fetch to get stock prices based on symbol.
  Push data object (symbol and price) in allStock array
  Add in db the symbol, ip, like
  Find in db for total number of likes for each stock
    Update data object for res.json
*/

'use strict';
require('dotenv').config();
var expect = require('chai').expect;
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var fetch = require('node-fetch');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function(app) {

  app.route('/api/stock-prices')
    .get(function(req, res, next) {

      async function Fetch(ticker) {
        try {
          const resp = await fetch(`https://repeated-alpaca.glitch.me/v1/stock/${ticker}/quote`);
          const json = await resp.json();
          if (json === 'Unknown symbol' || json === 'Not found') {
            return res.send('Unknown symbol')
          };

          let result = {
            stock: json.symbol,
            price: json.latestPrice.toString()
          };
          //console.log(result);
          return result;

        } catch (err) {
          return console.log(err);
        }
      }

      async function AddAndFindDB(ticker, like, ip) {
        let db = await MongoClient.connect(CONNECTION_STRING).catch(err => console.log(err));
        if (!db) {
          return;
        }

        try {
          const addResult = await db.collection('stock-checker').findAndModify(
            {$and: [{stock: ticker}, {ip: ip}]},
            {},
            {
              $set: {like: like},
              $setOnInsert: {
                _id: new ObjectId,
                stock: ticker,
                ip: ip,
              }
            },
            {
            upsert: true,
            new: true
          });

          const findResult = await db.collection('stock-checker').find(
            {$and: [
              {stock: ticker},
              {ip: ip},
              {like: true}]
            }
          ).toArray();

          return findResult;

        } catch (err) {
          return console.log(err);
        } finally {
          db.close();
        }
      }

      let ticker = [];
      if (Array.isArray(req.query.stock)) {
        ticker.push(...req.query.stock);
      } else {
        ticker.push(req.query.stock);
      };

      let like;
      if (req.query.like || req.body.like) {
        like = true;
      } else {
        like = false;
      }

      let stockData = {
        'stockData': null
      };
      let allStock = [];

      if (ticker.length === 1) {
        Promise.all([Fetch(ticker[0]),AddAndFindDB(ticker[0],like,req.ip)])
          .then(([stock,array])=>{
            stock.likes = array.length;
            stockData.stockData = stock;
            //console.log(stockData);
            res.json(stockData);
          })
      } else {
        Promise.all([
          Fetch(ticker[0]),
          AddAndFindDB(ticker[0],like,req.ip),
          Fetch(ticker[1]),
          AddAndFindDB(ticker[1],like,req.ip)
        ])
          .then(([stock1, array1, stock2, array2])=>{
            stock1.rel_likes = array1.length - array2.length;
            stock2.rel_likes = array2.length - array1.length;
            stockData.stockData = [stock1, stock2];
            //console.log(stockData);
            res.json(stockData);
          })
      }
    });

};
