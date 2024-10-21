const express = require('express');
const app = express();
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require('jsonwebtoken'); 
const cors = require('cors');
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());

//verify token 
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
      return res.status(401).send({ error: true, message: 'Unauthorize access' })
  }
  const token = authorization?.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
      if (err) {
          return res.status(403).send({ error: true, message: 'forbidden user or token has expired' })
      }
      req.decoded = decoded;
      next()
  })
}

// MONGO DB ROUTES
const { MongoClient, ServerApiVersion,ObjectId, Transaction } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@yoga-master.vtcya6j.mongodb.net/?retryWrites=true&w=majority&appName=yoga-master`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
 try {
    
    const database = client.db("yoga-master");
    const userCollections = database.collection("users");
    const classesCollecion = database.collection("classes");
    const cartCollection = database.collection("cart");
    const paymentCollection = database.collection("payments");
    const enrollmentsCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");
     client.connect();

    //set token
    app.post ("/api/set-token",async(req,res)=>{
      const user =req.body;
      const token= jwt.sign(user,process.env.ACCESS_SECRET, { expiresIn: '24H' });
      res.send({token});
    })
    //middleware for admin and instructor
    const verifyAdmin=async(req,res,next)=>{
    const email=req.decoded.email;
    const query ={email:email};
    const user=await userCollections.findOne(query);
    if (user.role ==='admin'){
      next();
    } else {
      return res.status(401).send({message:'unauthorized Access'})
    }
     }
    const verifyInstructor=async(req,res,next)=>{
      const email =req.decoded.email;
      const query ={email:email};
      const user=await userCollections.findOne(query);
      if (user.role==='instructor'||user.role==='admin'){
        next();
      }else{
        return res.status(401).send({message:'unauthorized Access'})
      }
    }
        
     //users route
    app.post('/new-user',async(req,res)=>{
      const newUser =req.body;
      const result=await userCollections.insertOne(newUser);
      res.send(result);
    });
    
    //get all users 
     app.get('/users',async(req,res)=>{
      const users=await userCollections.find().toArray();
      res.send(users);
     });
     //get user by id
     app.get('/users/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const user = await userCollections.findOne(query);
      res.send(user);
     })
     //get user by email
     app.get('/user/:email',verifyJWT,async(req,res)=>{
      const email=req.params.email;
      const query ={email:email};
      const result=await userCollections.findOne(query).toArray();
      res.send(result);
     })
     //delete a user 
     app.delete('/delete-user/:id',verifyJWT,verifyAdmin,async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectIdid};
      const result =await userCollections.deleteOne(query);
     });

     //update a user
     app.put('update-user/:id',verifyJWT,verifyAdmin,async(req,res)=>{
      const id =req.params.id;
      const updatedUser=req.body;
      const filter={_id:new ObjectId};
      const options={upsert:true};
      const updateDoc={
        $set:{
          name:updatedUser.name,
          email:updatedUser.email,
          role:updatedUser.option,
          adress:updatedUser.adress,
          photoUrl:updatedUser.photoUrl,
          about:updatedUser.about,
          skills:updatedUser.skills?updatedUser.skills:null,
        }
      }
      const result = await userCollections.updateOne(filter,updateDoc,options);
      res.send(result);
      } );


     // Classes route
    app.post('/new-class',verifyJWT,verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollecion.insertOne(newClass);
      res.send(result);
    });
    
    //manages classes
     app.get('/classes',async(req,res)=>
      {
        const query ={status:"approved"}
        const result=await classesCollecion.find(query).toArray();
        res.send(result);
      });
      app.get('/classes-manage',async(req,res)=>{
        const result=await classesCollecion.find().toArray();
        res.send(result);
      });
    //get classes by instructor email address
     app.get('/classes/:email',verifyJWT,verifyInstructor,async(req,res)=>{
      const email=req.params.email;
      const query={instructorEmail:email};
     const result =await classesCollecion.find(query).toArray();
     res.send(result);
    });
     
    
    //updates classes status and reason
    app.put('/change-status/:id',async(req,res)=>{
     const id =req.params.id;
     const status =req.body.status;
     const reason =req.body.reason;
     const filter ={_id:new ObjectId(id)};
     const options ={upsert:true};
     const updateDoc={
      $set:{
        status:status,
        reason:reason
      },
     };
     const result =await classesCollecion.updateOne(filter,updateDoc,options); 
     res.send(result);
    });
      // GET APPROVED CLASSES
      app.get('/approved-classes', async (req, res) => {
        const query = { status: 'approved' };
        const result = await classesCollection.find(query).toArray();
        res.send(result);
    })

    //get single class dataa 
    app.get('/class/:id',async(req,res)=>{
      const id =req.params.id;
      const query ={_id:ObjectId(id)};
      const result=await classesCollecion.findOne(query);
      res.send(result);

    });
    //get all instructors
   app.get('/instructors',async(req,res)=>{
     const result=await userCollections.find({role:'instructor'}).toArray();
     res.send(result);
     });
     // update class details
     app.patch('/update-class/:id',async(req,res)=>{
      const id =req.params.id;
      const updateClass=req.body
      const filter ={_id:new ObjectId(id)};
      const options ={upsert:true};
      const updateDoc={
       $set:{
         name:updateClass.name,
         description:updateClass.description,
         price:updateClass.price,
         availableSeats:parseInt(updateClass.availableSeats),
         videoLink:updateClass.videoLink,
         status:'pending',
         instructorName:updateClass.instructorName,
         instructorEmail:updateClass.instructorEmail,
         submitted:updateClass.submitted,
         totalEnrolled:updateClass.totalEnrolled,
         reason:updateClass.reason,
       },
      };
      const result =await classesCollecion.updateOne(filter,updateDoc,options); 
      res.send(result);
     });
    
     // cart Routes
     //add cart
    app.post('/add-to-cart',verifyJWT,async(req,res)=>{
      const newCartItem=req.body;
      const result =await cartCollection.insertOne(newCartItem);
      res.send(result);
    });
    
    //get cart item by id 
    app.get('/cart-item/:id',verifyJWT,async(req,res)=>{
      const id = req.params.id ;
      const email= req.query.email;
      const query ={
        classId:id ,
        userMail:email,
      };
      const projection = { classId:1 };
      const result = await cartCollection.findOne(query,{projection:projection});
      res.send(result);
    
    });

    //cart info by user email  
    app.get('/cart/:email',verifyJWT,async(req,res)=>{
       const email =req.params.email;
       const query = {userMail:email};
       const projection= {classId:1};
       const carts= await cartCollection.find(query).toArray();
       const classIds = carts.map((cart)=>new ObjectId(cart.classId));
       const query2= {_id:{$in:classIds}};
       const result = await cartCollection.find(query2).toArray();
       res.send(result);

       }
    );

    //delete cart item 
    app.delete('/delete-cart/:id',verifyJWT,async(req,res)=>{
      const id =req.params.id;
      const query={classId:id};
      const result=await cartcollection.deleteOne(query);
      res.send(result);
    });

  //payment routes 
      app.post("/create-payment-intent",verifyJWT,async(req,res)=>{
    const {price}=req.body;
    // Create a PaymentIntent with the order amount and currency
    const amount = parseInt(price)*100;
    const PaymentIntent=await stripe.PaymentIntent.create({
     amount:amount,
     currency:"eur",
     payment_methods: ["card"],
    });
    res.send({
      clientSecret:PaymentIntent.client_secret,
   } );
      });

//post payment info to db 
  app.post('/payment-info',verifyJWT,async(req,res)=>{
   const paymentInfo =req.body;
   const classId=paymentInfo.classId;
   const userEmail =paymentInfo.userEmail;
   const signaleClassId=req.query.classId;
   let query ;
   if (signleClassId){
    query={classId:signaleClassId,userMail:userEmail};
   }else {
      query={classId:{$in:classId}};
    }
   const classQuery ={_id:{$in:classId.map(id=>new ObjectId(id))}};
   const classes = await classesCollecion.find(classQuery).toArray();
   const newEnrolledData={
    userEmail:userEmail,
    classId:signaleClassId.map(id=>new ObjectId(id)),
    TransactionId:paymentInfo.TransactionId
   };
   const updateDoc ={
    $set:{
      totalEnrolled: classes.reduce((total,current)=>total+current.totalEnrolled,0)+1||0,
      availableSeats:classes.reduce((total,current)=>total+current.availableSeats,0)-1||0
    }
   };
   const updateResult=await classesCollecion.updateMany(classQuery,updateDoc,{upser:true});
   const enrolledResult=await enrollmentsCollection.insertOne(newEnrolledData);
   const deleteResult=await cartCollection.deletemany(query);
   const paymentResult =await paymentCollection.insertOne(paymentInfo);
   res.send({updateResult,enrolledResult,deleteResult,paymentResult})
  });

// get payment history
app.get('payment-history/:email',async(req,res)=>{
  const email=req.params.email;
  const query ={userEmail:email};
  const result=await paymentCollection.find(query).sort({date:-1}).toArray();
  res.send(result);
});

//payment history length
app.get('/payment-history-length/:email',async(req,res)=>{
  const email=req.params.email;
  const query ={userEmail:email};
  const total=await paymentCollection.countDocuments(query);
  res.send({total});
});

//enrollment routes 
app.get("/popular_classes",async(req,res)=>{
  const result =await classesCollecion.find().sort({totalEnrolled:-1}).limit(6).toArray();
  res.send(result)
});

//get popular instructors
app.get("/popular-instructors",async(req,res)=>{
  const pipeline=[
    {
      $group:{
        _id :"$instructorEmail",
        totalEnrolled:{$sum:"$totalEnrolled"}
      }
    },
      {
      $lookup:{
        Form:"users",
        localField:"_id",
        foreignField:"email",
        as:"instructor"
      }
    },
    { $project:{
      _id:0,
      instructor:{
       $arrayElemAt :["$instructor",0]
      },
      totalEnrolled:1
    }
    },
    {$sort:{
     totalEnrolled:1
    }},
    {$limit:6}
  ];
  
  const result =await classesCollecion.aggregate(pipeline).toArray();
  res.send(result)
});

//admin status
app.get('/admin-status',verifyJWT,verifyAdmin,async(req,res)=>{
   const approvedclasses =((await classesCollecion.find({status:'approved'})).toArray()).length;
   const pendingclasses =((await classesCollecion.find({status:'pending'})).toArray()).length;
   const instructors =((await userCollections.find({role:'instructor'})).toArray()).length;
   const totalClasses=(await userCollections.find().toArray()).length;
   const totalEnrolled=(await enrollmentsCollection.find().toArray()).length;
   res.send({approvedclasses,pendingclasses,instructors,totalClasses,totalEnrolled})
});

//enrolled classes by email
app.get('/enrolled-classes/:email',verifyJWT,async(req,res)=>{
  const email=req.params.email;
  const query ={userEmail:email}
  const pipeline=[
    {
    $match:query
    },
    {
      $lookup:{
        form:"classes",
        localField:"classesId",
        foreignField:"_id",
        as:"classes"
      }
     } ,
     {
        $unwind:"$classes"

        },
        {
          $lookup:{
            Form:"users",
            localField:"classes.instructorEmail",
            foreignField:"email",
            as:"instructor"
          }
        },{
          $project:{
            _id:0,
            instructor:{
              $arrayElemAt:["$instructor",0]
            },
            classes:1
          }
        } ];
  const result=await enrollmentsCollection.aggregate(pipeline).toArray();
  res.send(result);
});
//applied for instructors
app.post('/apply-instructor',async(req,res)=>{
  const data =req.body;
  const result= await appliedCollection.insertOne(data);

});
app.get('/applied-instructors/:email',async(req,res)=>{
  const email =req.params.emails;
  const result=await appliedCollection.findOne(email);
  res.send(result)
});

// Send a ping to confirm a successful connection
   // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error(err);
  } finally {
    // Ensures that the client will close when you finish/error
     client.close();
  }
}

// Basic route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Listen
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

run().catch(console.dir);
