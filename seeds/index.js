const Campground = require('../models/campground')
const mongoose = require('mongoose');
const cities = require('./cities');
const {places, descriptors} = require('./seedHelpers')
mongoose.connect('mongodb://127.0.0.1:27017/yelp-camp');
const axios = require('axios');

// const methodOverride = require('method-override'); // Used for edit fucntionality
// app.use(methodOverride('_method'));



// Connection
main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/yelp-camp');
  console.log('Connection Open')
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

const sample = array => array[Math.floor(Math.random() * array.length)]

const seedDB = async () =>{
    await Campground.deleteMany({});
    for(let i=0; i<50; i++){
        const random1000 = Math.floor(Math.random() * 1000);
        const price = Math.floor(Math.random() * 20) + 10;
        const unsplashResponse = await axios.get('https://api.unsplash.com/photos/random', {
            params: {
                client_id: 'SZUG3LiyPhXw9PMzSO2qvjxe7bEETLhlzGcMcIlSu1g',
                query: 'food', // You can change the query to get images related to your campgrounds
            },
        });
        const camp = new Campground({
            location : `${cities[random1000].city}, ${cities[random1000].state}`,
            title: `${sample(descriptors)} ${sample(places)}`,
            image : unsplashResponse.data.urls.regular,
            price,
            author: '653351663995152935f9619c'
        })
        await camp.save();
    }
}

seedDB().then(() =>{
    mongoose.connection.close();
})