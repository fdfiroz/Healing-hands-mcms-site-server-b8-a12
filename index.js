const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
  }
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(cookieParser())
  app.use(morgan('dev'))
  // app.use(express.urlencoded({ extended: true }));


//MongoDB Connection String
const uri = `mongodb+srv://${process.env.USERNAME_DB}:${process.env.PASSWORD_DB}@mcms.wqgwgln.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



//Connect to MongoDB
async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log(
        "Pinged your deployment. You successfully connected to MongoDB!"
      );
    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }
  }
  run().catch(console.dir);


const database = client.db("mcms");
const userCollection = database.collection("userCollection");
const campCollection = database.collection("campCollection");
const paymentCollection = database.collection("paymentCollection");

  

  //JWT Middleware
app.post("/api/v1/auth/access-token", async (req, res) => {
  const body = req.body;
  //   jwt.sign("payload", "secretKey", "expireInfo");
  // user: abc@gmail.com
  const token = jwt.sign(body, process.env.ACCESS_TOKEN, { expiresIn: "10h" });
  const expirationDate = new Date(); // Create a new Date object
  expirationDate.setDate(expirationDate.getDate() + 365); // Set the expiration date to 365 days from the current date
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      expires: expirationDate,
    })
    .send({ massage: "success" });
});
//logout
app.post("/api/v1/auth/logout", async (req, res) => {
  try{
    const user = req.body;
  res.clearCookie("token", { maxAge: 0 }).send({ message: "success" });
  }
  catch{
    console.log(error)
  }
});

//Camp related API

// Filtering API Format
//http://Localhost:5000/api/v1/camps  situation 1
//http://localhost:5000/api/v1/camps?specialServices=General-Health-Checkups  situation2
//http:///Localhost:5000/ap1/v1/camps?sortField=dateCreated&sortOrder=desc
//http://localhost:5000/api/v1/camps?search=home  Search API Format
app.get("/api/v1/camps", async (req, res) => {
  try{
    let queryObj = {};
    let sortObj = {};
    const specialServices = req.query.specialServices;
    const search = req.query.search;
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    if (specialServices) {
      queryObj.specialServices = specialServices;
    }
    if (search) {
      queryObj.title = new RegExp(search, "i");
    }
    if (sortField && sortOrder) {
      sortObj[sortField] = sortOrder;
    }
    const courser =  campCollection.find(queryObj).sort(sortObj);
    const result = await courser.toArray();
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});
app.get("/api/v1/camps/:id", async (req, res) => {
  try{
    const id = req.params.id;
    console.log(id)
    const result = await campCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});
app.post("/api/v1/add-camps", async (req, res) => {
  try{
    const camp = req.body;
    const result = await campCollection.insertOne(camp);
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});
app.delete("/api/v1/delete-camp/:id", async (req, res) => {
  try{
    const id = req.params.id;
    const result = await campCollection.deleteOne({ _id: ObjectId(id) });
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

app.put("/api/v1/update-camp/:id", async (req, res) => {
  try{
    const id = req.params.id;
    const camp = req.body;
    const result = await campCollection.updateOne(
      { _id: ObjectId(id) },
      { $set: camp }
    );
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

// User related API
app.post("/api/v1/users", async (req, res) =>{
  const user = req.body;
  console.log(user)
  const result = await userCollection.insertOne(user);
  res.send(result);
})

app.get("/api/v1/users/role/:email", async (req, res) => {
try{
  const email = req.params.email
  const result = await userCollection.findOne({email})
  res.send(result)
}
catch(error){
  console.log(error)
}
});

//Generate Payment Intent
app.post("/api/v1/create-payment-intent",  async (req, res)=>{
  const {fees} = req.body;
  console.log("form front end",fees)
  try{
    const amount = parseInt(fees * 100)
  if (!fees|| amount < 1) return
  const {client_secret} = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    // payment_method_type: ['card']
  });
  res.send({clientSecret: client_secret })
  }
  catch(error){
    console.log(error)
  }
})

//Save payment info to database
app.post("/api/v1/save-payment", async (req,res)=>{
  
  try{
    const paymentInfo = req.body;
  const result = await paymentCollection.insertOne(paymentInfo);
  res.send(result);
  }
  catch(error){
    console.log(error)
  }
});
//Show all payment info by user email
app.get("/api/v1/payment/:email", async (req, res)=>{
  try{
    const email = req.params.email
    const result = await paymentCollection.find({email})
    const data = await result.toArray();
    res.send(data)
  })
//Update popular camp count
app.patch("/api/v1/popular-count/:id", async (req, res)=>{
  const id = req.params.id;
  const {popularCount} = req.body;

  try {
    const camp = await campCollection.findOne({ _id: new ObjectId(id) });
    if (!camp) {
      return res.status(404).send({ message: "Camp not found" });
    }

    // Update the popular camp count
    camp.popularCount = camp.popularCount ? camp.popularCount + popularCount : popularCount;

    // Save the updated camp
    const updateDoc = {
      $set: camp,
    };
    await campCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

    res.send({ message: "Popular camp count updated" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

//Start server
  app.get('/', (req, res) => {
    res.send('Hello from MCMS Server.')
  })
  
  app.listen(port, () => {
    console.log(`MCMS is running on port ${port}`)
  })
  