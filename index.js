const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
require('dotenv').config();
const app = express();

const SSLCommerzPayment = require('sslcommerz-lts');
const store_id = process.env.SSL_STORE_ID;
const store_passwd = process.env.SSL_STORE_PASS;
const is_live = false //true for live, false for sandbox

const bookingData = require('./fakedb.json');

const port = process.env.PORT || 5000;

// ----->>>> Middlewares <<<<-----
app.use(cors());
app.use(express.json());
app.use(express.static('doctors'));
app.use(fileUpload());


const { MongoClient, ServerApiVersion, string, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vp86zhc.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const appointmentCollection = client.db("doctors-insight").collection("appointments");
        const serviceCollection = client.db("doctors-insight").collection("serviceDatabase");
        const doctorsCollection = client.db("doctors-insight").collection("availableDoctors");
        const userCollection = client.db("doctors-insight").collection("users");
        const paymentCollection = client.db("doctors-insight").collection("payments");


        //----->>>> JWT related api <<<<-----
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })

        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        //------>>>> create verifyAdmin function <<<<----
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next()
        }


        // ----->>>> Create email-pass user <<<<-----
        app.post('/users', async (req, res) => {
            const file = req.files.file;
            const displayName = req.body.name;
            const email = req.body.email;
            const password = req.body.password;
            const photoURL = `http://localhost:5000/${file.name}`;
            // console.log(file, name, email, password, photoURL);
            const newUser = { displayName, email, password, photoURL };

            file.mv(`${__dirname}/doctors/${file.name}`, err => {
                if (err) {
                    console.log(err);
                    return res.status(500).send({ msg: 'failed to upload image' })
                }
            })
            const result = await userCollection.insertOne(newUser);
            res.send(result);
        })

        // ----->>>> Create Google User <<<<-----
        app.post('/googleuser', async (req, res) => {
            const displayName = req.body.displayName;
            const email = req.body.email;
            const photoURL = req.body.photoURL;
            const googleUser = { displayName, email, photoURL };
            // console.log(googleUser);
            const query = { email: googleUser.email }
            const existingUser = await userCollection.findOne(query);
            // console.log('existing user', existingUser);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await userCollection.insertOne(googleUser);
            res.send(result);
        })

        // ----->>>> Load all user <<<<-----
        app.get('/user', verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers);
            const result = await userCollection.find().toArray();
            // console.log(result)
            res.send(result);
        })

        //---->>>> Delete user <<<<-----
        app.delete('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        //---->>> Make Admin for any user <<<---
        app.patch('/user/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        //---->>> Make User for any admin <<<---
        app.patch('/user/make-user/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'user'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //=====>>>> Check admin <<<<=====
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })

        // ------->>> Load all services <<<------
        app.get('/booking', async (req, res) => {
            const allService = serviceCollection.find();
            const result = await allService.toArray();
            // console.log(result)
            res.send(result);
        })

        // ------>>>> Space Update <<<<-----
        // app.put('/appointment/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const updateSpace = req.body;
        //     console.log(updateSpace)
        // const filter = { _id: new ObjectId(id) };
        // const options = { upsert: true };
        // const serviceUpdate = {
        //     $set: {
        //         space: updateSpace.space
        //     }
        // }
        // const result = await serviceCollection.updateOne(filter, serviceUpdate, options);
        // res.send(result);
        // })


        // app.post('/myappointment', async (req, res) => {
        //     res.send(bookingData);
        // })

        // ---->>>> make appointment <<<<-----
        app.post('/appointment', async (req, res) => {
            const appointment = req.body;
            // console.log(appointment);
            const result = await appointmentCollection.insertOne(appointment);
            res.send(result);
        })

        // ----->>> All appointments collection <<<-----
        // app.get('/appointment', async (req, res) => {
        //     const allApplication = appointmentCollection.find();
        //     const result = await allApplication.toArray();
        //     res.send(result);
        // })


        // ----->>>> Load All services <<<<-----
        app.get('/services', async (req, res) => {
            const allServices = await serviceCollection.find().toArray();
            res.send(allServices);
        })

        // ----->>>> Load Individual Services <<<<-----
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })

        // ---->>>> Update services <<<<----
        app.put('/services/:id', async (req, res) => {
            const id = req.params.id;
            const updateServiceItem = req.body;
            // console.log(id, updateServiceItem)
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedService = {
                $set: {
                    name: updateServiceItem.name,
                    space: updateServiceItem.space,
                    price: updateServiceItem.price
                }
            }
            const result = await serviceCollection.updateOne(filter, updatedService, options);
            res.send(result);
        })

        // ------>>>< Delete services <<<<------
        app.delete('/services/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        })

        // ----->>>> Create payment proceed <<<<-----
        app.post('/proceed-payment', async (req, res) => {
            const selectedAppointment = await appointmentCollection.findOne({ _id: new ObjectId(req.body.patientId) });
            const paymentInfo = req.body;
            const trans_id = new ObjectId().toString();
            // console.log(selectedAppointment);
            const data = {
                total_amount: selectedAppointment?.price,
                currency: paymentInfo.currency,
                tran_id: trans_id, // use unique tran_id for each api call
                success_url: 'http://localhost:3030/success',
                fail_url: 'http://localhost:3030/fail',
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Onsite',
                product_name: paymentInfo.name,
                product_category: '',
                product_profile: 'general',
                cus_name: paymentInfo.patient,
                cus_email: selectedAppointment?.email,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: paymentInfo.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            // console.log(data);

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL })
                console.log('Redirecting to: ', GatewayPageURL)
            });
        })

        // ---->>> Appointments by particular date <<<-----
        app.post('/appointmentbydate', async (req, res) => {
            const date = req.body;
            // console.log(date);
            // const email = req.body.email;
            const query = { date: date.date };
            const result = await appointmentCollection.find(query).toArray();
            res.send(result);
            // console.log(result);
        })

        // ----->>>> Appointments by each user <<<<-----
        app.get('/appointments/:email', async (req, res) => {
            const email = req.params.email
            // console.log(email);
            const query = { email: email };
            const result = await appointmentCollection.find(query).toArray();
            // console.log(result);
            res.send(result)
        })

        // ----->>>> Load selected appointment <<<<-----
        app.get('/appointment-payment/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await appointmentCollection.findOne(query);
            // console.log(result);
            res.send(result)
        })

        // ----->>>> Delete selected appointment <<<<-----
        app.delete('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await appointmentCollection.deleteOne(query);
            // console.log(result);
            res.send(result)
        })

        // ----->>> ADD a Doctor <<<-----
        app.post('/addDoctor', async (req, res) => {
            const doctorsFiles = req.body;
            // console.log(doctorsFiles);
            const result = await doctorsCollection.insertOne(doctorsFiles);
            res.send(result);
        })

        // ----->>>> Load all doctor <<<<-----
        app.get('/addDoctor', async (req, res) => {
            const doctorsFiles = doctorsCollection.find();
            const result = await doctorsFiles.toArray();
            res.send(result);
            // console.log(result)
        })

        //----- >>>> Load Individual Doctor <<<<-----
        app.get('/docInfo/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorsCollection.findOne(query);
            res.send(result);
        })

        // ---->>>> Update Doctor <<<<----
        app.put('/docInfo/:id', async (req, res) => {
            const id = req.params.id;
            const updateDocInfo = req.body;
            // console.log(id, updateServiceItem)
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    image: updateDocInfo.image,
                    name: updateDocInfo.name,
                    speciality: updateDocInfo.speciality,
                    email: updateDocInfo.email
                }
            }
            const result = await doctorsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // ------>>>< Delete Doctor <<<<------
        app.delete('/docInfo/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await doctorsCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Doctros Insight server is running');
})


// // ----->>> ADD a Doctor <<<-----
// app.post('/addDoctor', (req, res) => {
//     const file = req.files.file;
//     const name = req.body.name;
//     const email = req.body.email;
//     console.log(file, name, email);
//     file.mv(`${__dirname}/doctors/${file.name}`, err => {
//         if (err) {
//             console.log(err);
//             return res.status(500).send({ msg: 'failed to upload image' })
//         }
//         return res.send({ name: name, email: email, path: `/${file.name}` })
//     })
// })

// app.post('/booking', (req, res) => {
//     const updateSpace = req.body;
//     res.send(updateSpace);
// })


app.listen(port, () => {
    console.log(`Doctors Insight server is running on ${port}`);
})