const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
  }
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(cookieParser())
  app.use(morgan('dev'))

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
  res.send(result.role)
}
catch(error){
  console.log(error)
}
});
//Start server
  app.get('/', (req, res) => {
    res.send('Hello from MCMS Server.')
  })
  
  app.listen(port, () => {
    console.log(`MCMS is running on port ${port}`)
  })
  