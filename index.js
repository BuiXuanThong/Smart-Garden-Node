import express from 'express';
import fetch from 'node-fetch';
import { createRequire } from "module";
const require = createRequire(import.meta.url);


// firebase
var admin = require("firebase-admin");

var serviceAccount = require("./util/myfirebase-dbb-2cc3a42c0a56.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://myfirebase-dbb-default-rtdb.asia-southeast1.firebasedatabase.app"
});


const createAlert = (type, currVal, min, max) => {
    const timeNow = Date.now();
    const day = new Date(timeNow).getDate();
    const month = new Date(timeNow).getMonth() + 1;
    const year = new Date(timeNow).getFullYear();
    const hour = new Date(timeNow).getHours();
    let minute = new Date(timeNow).getMinutes();
    if (minute < 10) {
        minute = "0" + minute;
    }
    let second = new Date(timeNow).getSeconds();
    if (second < 10) {
        second = "0" + second;
    }
    const date = day + "/" + month + "/" + year;
    const time = hour + ":" + minute + ":" + second;
    const fixedTime = date + " " + time;


    const content = {   time: fixedTime,
                        content:  type + " is out of range. Current value is " + currVal + " and range is [" + min + ",  " + max + "]"};
    const todoRef = admin.database().ref('Notifications');
    todoRef.push(content);
}




const getData = async () => {
    const tempResponse = await fetch('https://io.adafruit.com/api/v2/trong249/feeds/bbc-temp/data/retain');
    const temp = (await tempResponse.text()).split(',');
    const tempValue = parseFloat(temp[0]) ;
    const humidResponse = await fetch('https://io.adafruit.com/api/v2/trong249/feeds/bbc-humi/data/retain');
    const humid = (await humidResponse.text()).split(',');
    const humidValue = parseFloat(humid[0]);

    const lightResponse = await fetch('https://io.adafruit.com/api/v2/trong249/feeds/bbc-light/data/retain');
    const light = (await lightResponse.text()).split(',');
    const lightValue = parseFloat(light[0]);

    const grHumidResponse = await fetch('https://io.adafruit.com/api/v2/trong249/feeds/bbc-humi-ground/data/retain');
    const grHumid = (await grHumidResponse.text()).split(',');
    const grHumidValue = parseFloat(grHumid[0]);

    return {
        tempValue: tempValue,
        humidValue: humidValue,
        lightValue: lightValue,
        grHumidValue: grHumidValue
    }
}
const checkAlert = async () => {
    const data = await getData();
    admin.database().ref('Min_max').on("value", (snapshot) => {
        snapshot.forEach((child) => {
            // if temperature
            if (child.key === "temperature") {
                if(data.tempValue > child.val().max || data.tempValue < child.val().min) {
                    createAlert("Temperature", data.tempValue, child.val().min, child.val().max);
                }
            }
            else if (child.key === "humid") {
                if(data.humidValue > child.val().max || data.humidValue < child.val().min) {
                    createAlert("Humidity", data.humidValue, child.val().min, child.val().max);
                }
            }
            else if (child.key === "light") {
                if(data.lightValue > child.val().max || data.lightValue < child.val().min) {
                    createAlert("Light", data.lightValue, child.val().min, child.val().max);
                }
            }
            else if (child.key === "ground_humid") {
                if(data.grHumidValue > child.val().max || data.grHumidValue < child.val().min) {
                    createAlert("Ground Humidity", data.grHumidValue, child.val().min, child.val().max);
                }
            }
        });
    });

}

// setInteval
setInterval(checkAlert, 10000);

// var firebase = require('firebase');
// firebase.initializeApp({
//     databaseURL: 'https://myfirebase-dbb-default-rtdb.asia-southeast1.firebasedatabase.app',
//     credential: './util/myfirebase-dbb-2cc3a42c0a56.json', // This is the serviceAccount.json file
// });


const app = express();
const PORT = process.env.PORT || 5000;

// // fetch data from api link
// const response = await fetch('https://io.adafruit.com/api/v2/trong249/feeds/bbc-led/data');
// const data = await response.json();

const getChartData = async (type, hours) => {
    // fetch(`https://io.adafruit.com/api/v2/trong249/feeds/bbc-humi/data/chart?hours=${hours}`).then((response) => response.json())
    // .then((dataJson) =>{
    //       const dat = {};
    //       dat.labels = dataJson.data.map((point) => point[0]);
    //       dat.datasets = {label: "bbc-temp", data: dataJson.data.map((point) => point[1] )};
    //       setTempData({labels: dat.labels, datasets: dat.datasets});
    //       console.log(tempData);
    //       // return dat;
    //     })
    
    const chartResponse = await fetch(`https://io.adafruit.com/api/v2/trong249/feeds/bbc-${type}/data/chart?hours=${hours}`);
    const chartData = (await chartResponse.json()).data; //array 
    console.log(chartData)
    console.log(typeof chartData);
    if (chartData.length == 0) return [];
    let lastPoint = new Date(chartData[0][0]);
    let reduceData = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < chartData.length; i++){
        const time = new Date(chartData[i][0]);
        if (time.getMinutes() - lastPoint.getMinutes() >= 0 && time.getMinutes() - lastPoint.getMinutes() <= 1){
            count += 1;
            sum += chartData[i][1];
        } else {
            let ave = sum/count;
            reduceData.push([lastPoint, ave]);
            lastPoint = new Date(chartData[i][0]);
            count = 1;
            sum = chartData[i][1];
        }
    }
    console.table(reduceData);
    let data = {};
    data.labels = reduceData.map((point) => point[0])
    let innerData = [];
    innerData = reduceData.map((point, i) =>  point[1])
    for (let i = 0; i < innerData.length; i++){
        if (!(innerData[i])){
            innerData[i] = innerData[i-1];
        }
    }
    data.datasets = {label: "bbc-temp", data: innerData};
    return data;


    
}

app.get("/dashboard/data/temp-chart/:hours", async (req, res) =>{
    const hours = req.params.hours;
    const type = "temp";
    const data = await getChartData(type, hours);
    res.send(data);
})

app.get("/dashboard/data/humid-chart/:hours", async (req, res) =>{
    const hours = req.params.hours;
    const type = "humi";
    const data = await getChartData(type, hours);
    res.send(data);
})

app.get("/dashboard/data/humid-ground-chart/:hours", async (req, res) =>{
    const hours = req.params.hours;
    const type = "humi-ground";
    const data = await getChartData(type, hours);
    res.send(data);
})

app.get("/dashboard/data/light-chart/:hours", async (req, res) =>{
    const hours = req.params.hours;
    const type = "light";
    const data = await getChartData(type, hours);
    res.send(data);
})

app.get("/dashboard/data/cards", async (req, res) => {
    const result = await getData()
    res.send(result);
});

app.get("/myapi", (req, res) => {
    res.send("Api here bro!");
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});