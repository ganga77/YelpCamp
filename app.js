if (process.env.NODE_ENV !== "production"){
  require('dotenv').config();
}

console.log(process.env.secret)

const express = require('express');
const app = express();
const path = require('path');
const ejsMate = require('ejs-mate');
const catchAsync = require('./utils/catchAsync') // this is used to create error.
const flash = require('connect-flash')

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}))

const Campground = require('./models/campground')
const Review = require('./models/review')
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/yelp-camp');

const methodOverride = require('method-override'); // Used for edit fucntionality
const campground = require('./models/campground');
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);

const session = require('express-session');
const passport = require('passport');
const multer = require('multer')
const {storage} = require('./cloudinary')
const upload = multer({storage})
const LocalStrategy = require('passport-local')
const User = require('./models/users')
const {isLoggedin, isAuthor} = require('./middleware')


app.use(session({ secret: 'anything' }));
app.use(passport.initialize());
app.use(passport.session());


// Connection
main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/yelp-camp');
  console.log('Connection Open')
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

// Initialising session
const sessionConfig = {
  secret: 'better!',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 *24 * 7,
    maxAge: 1000 * 60 * 60 *24 * 7
  }
}
app.use(session(sessionConfig))

// flash
app.use(flash())

// This middleware is used for defining the global variables like current user etc
app.use((req, res, next) =>{
  res.locals.currentUser = req.user;
  console.log('User1111:', req.user);
  
  res.locals.success = req.flash('success')
  next();
})

//passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()))

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/campgrounds', isLoggedin, async (req, res) =>{
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', {campgrounds})
})

// signup routes
app.get('/register', (req,res) =>{
  res.render('form/register')
})

app.post('/register', async(req, res, next) =>{
  try{
    const {username, password, email}  = req.body;
  const user = new User({email, username});
  const registeredUser = await User.register(user, password);
  passport.serializeUser(User.serializeUser());
  req.login(registeredUser, err =>{ // This login method requires a callback
    if (err) return next(err);
    res.redirect('/campgrounds')
  })
  
  }catch (err){
    req.flash('error', err.message);
    res.redirect('/register')
  }
  
})

// login routes
app.get('/login', (req, res) =>{
    res.render('form/login')
})

app.post('/login', passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}), (req, res) =>{
  
  try{
    passport.serializeUser(User.serializeUser());
    const redirectUrl = req.session.returnTo || '/campgrounds'
    delete req.session.returnTo;
    res.redirect(redirectUrl); 
  }catch (e){
    res.redirect('/register')
  }
})


// new campground route. Here we will be using passport's isAuthenticated method(in middleware.js) which will check if a user is loggedin or not.
app.get('/campgrounds/news', isLoggedin, (req, res) => {
  
  res.render('campgrounds/news')
  
})

app.post('/campgrounds', upload.array('image'), catchAsync(async (req, res, next) => {
  
  try{
    const {title, location, price} = req.body;
    const campground = new Campground({
        title, location, price
    });
    
    console.log(req.file)
    
    campground.author = req.user._id;
        await campground.save();
        req.flash('success', 'Successfully created new campground');
        res.redirect('/campgrounds')
  
  }catch (err){
    console.log(err)
  }
    

  // const campground = new Campground(req.body.campground);
  // await campground.save();
  // res.redirect(`/campgrounds/${campground.id}`)
  
}));

app.get('/campgrounds/:id', isLoggedin, catchAsync(async(req, res, next) =>{
  
    const {id} = req.params;
    const camp = await Campground.findById(id).populate({
      path: 'reviews',
      populate: {
        path: 'author',
      },
    }).populate('author');
  console.log(camp)
  res.render('campgrounds/show', {camp})
  
}))

app.get('/campgrounds/:id/edit', isLoggedin, isAuthor, catchAsync(async (req, res, next) =>{
  
    const {id} = req.params;
  const camp_id = await Campground.findById(id);
  if(!camp_id){
    return res.status(404).send('Product not found');
    return res.redirect('/campgrounds')
  }
  

  res.render('campgrounds/edit', {camp_id})
  
}))

app.put('/campgrounds/:id', catchAsync(async (req, res) => {
  const { id } = req.params;

  
      // Use await to properly update the product and get the updated data
      const camp = await Campground.findByIdAndUpdate(id, req.body, { runValidators: true, new: true });

      if (!camp) {
          return res.status(404).send('Product not found');
      }

      res.redirect(`/campgrounds/${camp._id}`);
  
}));

// First the button in show.ejs will send the delete request with particular id(Show in show.ejs). Then the server receives this request
app.delete('/campgrounds/:id', isLoggedin, isAuthor, async (req, res) =>{
  const {id} = req.params;
  const deletedProduct = await Campground.findByIdAndDelete(id);
  res.redirect('/campgrounds');

})

app.delete('/campgrounds/:id/reviews/:reviewId', async(req,res) =>{
  const {id, reviewId} = req.params;
  await Campground.findByIdAndUpdate(id, {$pull: {reviews: reviewId}});
  await Review.findByIdAndDelete(reviewId);
  res.redirect(`/campgrounds/${id}`)
  

  // console.log(rwdt)
})


app.post('/campgrounds/:id/reviews', isLoggedin, catchAsync(async (req, res) => {
  const id = req.params.id;
  try {
    const campground = await Campground.findById(id).populate({
      path: 'reviews',
      populate: {
        path: 'author',
      },
    }).populate('author');
    
    if (!campground) {
      return res.status(404).send('Campground not found');
    }

    

    // Log the request body to check if form data is being sent correctly
    console.log(req.body);
    
    const review = new Review(req.body.review);

    campground.reviews = campground.reviews || [];
    review.author = req.user._id; // This will push the user who made the review into author object of the reviews
    campground.reviews.push(review);
    await review.save();
    
    await campground.save();

    res.redirect(`/campgrounds/${campground._id}`);
    
  } catch (err) {
    console.error(err); // Log any errors to the console for debugging
    res.status(500).send('Internal Server Error'); // You can customize error handling further
  }
}));

//logout middleware
app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
      if (err) {
          return next(err);
      }
      console.log('LoggedOut')
      res.redirect('/campgrounds');
  });
}); 


// Error handling middleware
app.use((err, req, res, next) => {
  const { status = 500, message = 'Something went wrong!' } = err;
  res.status(status).send(message)
});

app.listen(3000, () =>{
    console.log('Serving on port 3000')
})