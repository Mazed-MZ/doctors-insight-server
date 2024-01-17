const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
require('dotenv').config();
const app = express();
const bookingData = require('./fakedb.json');

const port = process.env.PORT || 5000;

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


        // ------->>> All services <<<------
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
        app.get('/appointment', async (req, res) => {
            const allApplication = appointmentCollection.find();
            const result = await allApplication.toArray();
            res.send(result);
        })

        // ---->>> Appointments by particular date <<<-----
        app.post('/appointmentsbydate', async (req, res) => {
            const date = req.body;
            const email = req.body.email;
            const query = appointmentCollection.find(date);
            const result = await query.toArray();
            res.send(result);
        })

        // ----->>> ADD a Doctor <<<-----
        app.post('/addDoctor', async (req, res) => {
            const doctorsFiles = req.body;
            // console.log(doctorsFiles);
            const result = await doctorsCollection.insertOne(doctorsFiles);
            res.send(result);
        })

        app.get('/addDoctor', async (req, res) => {
            const doctorsFiles = doctorsCollection.find();
            const result = await doctorsFiles.toArray();
            res.send(result);
            // console.log(result)
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