const mongoose = require('mongoose')
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
    email:{
      type: String,
      required: [true, 'Email cannot be blank'],
      unique: true
    }
})

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);

