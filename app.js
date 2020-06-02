const express = require('express')
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose')
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage')
const Grid = require('gridfs-stream')
const methodOverride = require('method-override')

const app = express()

app.use(express.json())
app.use(methodOverride('_method'))  //querystring for form in order to make delete request (?)
app.set('view engine', 'ejs')

//MongoDB
const mongoURI = 'mongodb+srv://christof:Spotson123@cluster0-zm0hw.mongodb.net/test?retryWrites=true&w=majority'
const conn = mongoose.createConnection(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })

//init gfs
let gfs;

conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('uploads')
})

//Create Storage Engine

const storage = new GridFsStorage({     // function pasted from https://github.com/devconcept/multer-gridfs-storage
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {  //used to create the name of uploaded file
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'   //match gfs.collection
                };
                resolve(fileInfo);    // resolve the promise
            });
        });
    }
});
const upload = multer({ storage });


// Get Route 
// Loads Form
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {

        if (!files || files.length === 0) {
            res.render('index', { files: false })
        } else {
            files.map(file => {
                if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                    file.isImage = true
                } else {
                    file.isImage = false
                }
            })
            res.render('index', { files: files })
        }
    })
})

// Get/Files
// get all file info as json objects array
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {

        if (!files || files.length === 0) {
            return res.status(404).json({
                err: 'No Files Exist'
            })
        }
        //Files DO exist:
        return res.json(files)  //return files ARRAY
    })
})

// Get /files/:filename
// display ONE file object
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'no such file'
            })
        }
        //File DOES exist:
        return res.json(file)
    })
})

// Get /image/:filename
// display image
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'no such file'
            })
        }
        //Check if image
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {

            const readstream = gfs.createReadStream(file.filename)
            readstream.pipe(res)
        } else {
            res.status(404).json({
                err: 'not an image'
            })
        }
    })
})

// Post Route
// uploads file to db
app.post('/upload', upload.single('file'), (req, res) => {  //'file': name of input in form
    res.json({ file: req.file })
})

//Delete Route /files/:id
//delete files
app.delete('/files/:id', (req, res)=>{
    gfs.remove({_id: req.params.id, root: 'uploads'}, (err, gridStore) =>{
        if(err){
            return res.status(404).json({ err: err})
        }
        res.redirect('/')
    })
})

const port = 5000
app.listen(port, () => console.log(`server running on port ${port}`))