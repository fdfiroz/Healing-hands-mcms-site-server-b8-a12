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
const registerCampCollection = database.collection("registerCampCollection");
const feedbackCollection = database.collection("feedbackCollection");

  

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
const verify = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const verifyParticipants = async (req, res, next) => {
  const user = req.user
  console.log('user from verify Participants', user)
  const query = { email: user?.email }
  const result = await userCollection.findOne(query)
  if (!result || result?.role !== 'Participants')
    return res.status(401).send({ message: 'unauthorized access' })
  next()
}
const verifyOrganizers = async (req, res, next) => {
  const user = req.user
  console.log('user from verify Organizers', user)
  const query = { email: user?.email }
  const result = await userCollection.findOne(query)
  if (!result || result?.role !== 'Organizers')
    return res.status(401).send({ message: 'unauthorized access' })
  next()
}
const verifyHealthcareProfessionals = async (req, res, next) => {
  const user = req.user
  console.log('user from verify Healthcare-Professionals', user)
  const query = { email: user?.email }
  const result = await userCollection.findOne(query)
  if (!result || result?.role !== 'Healthcare-Professionals')
    return res.status(401).send({ message: 'unauthorized access' })
  next()
}

//Camp related API
//public API
// Filtering API Format
//http://Localhost:5000/api/v1/camps  situation 1
//http://localhost:5000/api/v1/camps?specialServices=General-Health-Checkups  situation2
//http:///localhost:5000/api/v1/camps?sortField=popularCount&sortOrder=desc
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
//All login user
app.get("/api/v1/camps/:id", verify, async (req, res) => {
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
app.get("/api/v1/get-camps/:orgId", verify, verifyOrganizers, async (req, res) => {
  try{
    const orgId = req.params.orgId;
    console.log(orgId)
    const result = await campCollection.find({orgId: orgId}).toArray()
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

//update camp 
app.patch("/api/v1/update-camp/:id", verify, verifyOrganizers, async (req, res) => {
  try{
    const id = req.params.id;
    const camp = req.body;
    const result = await campCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: camp }
    );
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

app.delete("/api/v1/delete-camp/:id", verify, verifyOrganizers, async (req, res) => {
  try{
    const id = req.params.id;
    const result = await campCollection.deleteOne({ _id: new ObjectId(id)});
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

// app.put("/api/v1/update-camp/:id", async (req, res) => {
//   try{
//     const id = req.params.id;
//     const camp = req.body;
//     const result = await campCollection.updateOne(
//       { _id: ObjectId(id) },
//       { $set: camp }
//     );
//     res.send(result);
//   }
//   catch(error){
//     console.log(error)
//   }
// });

app.patch('/api/v1/status-change/:id', verify, async (req, res) => {
  try {
    const id = req.params.id;
    const paymentStatus = req.body.paymentStatus;
    const registerStatus = req.body.registerStatus;
    const transactionId = req.body.transactionId;
    const update = {}
    if (paymentStatus) update.paymentStatus = paymentStatus
    if (registerStatus) update.registerStatus = registerStatus
    if (transactionId) update.transactionId = transactionId
    console.log(id, paymentStatus, registerStatus, transactionId)
    const result = await registerCampCollection.updateOne(
      { _id: new ObjectId(id) }, 
      { $set: update }
    );
    res.send(result);
  } catch (error) {
    console.log(error);
  }
});
//Cancel register and registerStatus change to Canceled
app.patch('/api/v1/cancel-register/:id', verify, async (req, res) => {
  try {
    const id = req.params.id;
    const registerStatus = req.body.registerStatus;
    const result = await registerCampCollection.updateOne(
      { _id: new ObjectId(id) }, 
      { $set: { registerStatus: registerStatus } }
    );
    res.send(result);
  } catch (error) {
    console.log(error);
  }
});

//get popular camps by popularCount and sorting fetature by params









app.post("/api/v1/add-camps", verify, verifyOrganizers, async (req, res) => {
  try{
    const camp = req.body;
    const result = await campCollection.insertOne(camp);
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});


//Feedback related API
app.post("/api/v1/add-feedback", verify, verifyParticipants,async (req, res) => {
  try{
    const feedback = req.body;
    const result = await feedbackCollection.insertOne(feedback);
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});

//Public API
app.get("/api/v1/feedbacks", async (req, res) => {
  try{
    const result = await feedbackCollection.find({}).toArray();
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});


//Register Camp related API
app.post("/api/v1/register-camp", verify, async (req, res) => {
  try{
    const registerCamp = req.body;
    const result = await registerCampCollection.insertOne(registerCamp);
    res.send(result);
  }
  catch(error){
    console.log(error)
  }
});
app.get("/api/v1/register-camps/:email", verify, async (req, res) => {
  try{
    const email = req.params.email;
    const result =  registerCampCollection.find({ registerEmail: email });
    const data = await result.toArray();
    res.send(data);
  }
  catch(error){
    console.log(error)
  }
});

//Get register camp by orgId
app.get("/api/v1/register-camps/org/:orgId", verify, async (req, res) => {
  try{
    const orgId = req.params.orgId;
    console.log(req.params)
    const result =  registerCampCollection.find({ orgId: orgId });
    const data = await result.toArray();
    res.send(data);
  }
  catch(error){
    console.log(error)
  }
});

app.get("/api/v1/register-camp:id", async (req, res) => {
  try{
    console.log(req)
    const id = req.params.id;
    const result = await registerCampCollection.findOne({ _id: new ObjectId(id) });
    res.send(id);
  }
  catch(error){
    console.log(error)
  }
});

//show all confirmed register camp by user email
app.get("/api/v1/confirmed-register-camps/:email", verify, async (req, res) => {
  try{
    const email = req.params.email;
    const paymentStatus = "Paid"
    const result =  registerCampCollection.find({ registerEmail: email, paymentStatus: paymentStatus });
    const data = await result.toArray();
    res.send(data);
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

app.patch("/api/v1/users/:id", verify, async (req, res) => {
  const id = req.params.id;
  const user = req.body;
  console.log(user)
  const result = await userCollection.updateOne({ _id: new ObjectId(id) }
  , { $set: user });
  res.send(result);
});

app.get("/api/v1/users/role/:email", verify, async (req, res) => {
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
app.post("/api/v1/create-payment-intent", verify, async (req, res)=>{
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
app.post("/api/v1/save-payment", verify, async (req,res)=>{
  
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
app.get("/api/v1/payments/:email", verify, async (req, res)=>{
  try{
    const payerEmail = req.params.email

    const result = paymentCollection.find({payerEmail})
    const data = await result.toArray();
    res.send(data)
  }
  catch(error){
    console.log(error)
  }
})
//Update popular camp count
app.patch("/api/v1/popular-count/:id", verify, async (req, res)=>{
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
  