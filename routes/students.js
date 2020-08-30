const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const emailValidator = require("email-validator");
const { to } = require("await-to-js");
const { studentsModel,enrolledModel,coursesModel } = require('../lib/mysql/sequelize')
const Sequelize=require('sequelize')
const Op = Sequelize.Op;
// Get all Students
router.get("/", async (req, res) => {
    let [error, data] = await to(
        studentsModel.findAll({
            attributes:['id','username']
        })
    );
    if (error) {
        return res.status(500).send({ data: null, error:error.errors[0].message });
    }
    res.status(200).send({ data, error: null });
});

// Get Specific Student Whole Details
router.get("/:id", auth, async (req, res) => {
    if (req.id !== parseInt(process.env.ADMIN_ID) && req.id !== parseInt(req.params.id))
        return res
            .status(401)
            .send({
                data: null,
                error: "Invalid Token or Student does not Exists",
            });
    let [error, data] = await to(
        studentsModel.findAll({
            where:{
                id:parseInt(req.id)
            }
        })
    );
    if (error) {
        return res.status(500).send({ data: null, error:error.errors[0].message });
    }
    if (data.length === 0)
        return res
            .status(404)
            .send({ data: null, error: `No student with ID:${req.params.id}` });
    res.status(200).send({ data, error: null });
});

// Login
router.post("/login", async (req, res) => {
    let email = req.body.email.trim().toString(),
        password = req.body.password.trim().toString();

    if (
        !email ||
        !password ||
        !emailValidator.validate(email) ||
        password.length <= 5
    )
        return res.status(400).send({ data: null, error: `Invalid Form Data` });

    let [error, data] = await to(
        studentsModel.findAll({
            where:{
                email,
                password
            }
        })
    );
    if (error) return res.status(500).send({ data: null, error:error.errors[0].message });

    if (data.length == 0)
        return res
            .status(404)
            .send({ data: null, error: "Invalid Email or Password" });

    const token = jwt.sign({ id: data[0].id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
    });

    res.status(200).send({ data: { token }, error: null });
});

// Signup
router.post("/signup", async (req, res) => {
    let username, email, password;
    try {
        (username = req.body.username.trim().toString()),
            (email = req.body.email.trim().toString()),
            (password = req.body.password.trim().toString());
    } catch (e) {
        return res.status(400).send({ data: null, error: `Invalid Form Data` });
    }

    if (
        !username ||
        !email ||
        !password ||
        !emailValidator.validate(email) ||
        password.length < 6
    )
        return res.status(400).send({ data: null, error: `Invalid Form Data` });

    let student = {
        ...req.body,
    };

    let [error, data] = await to(
        studentsModel.create(student)
    );
    if (error) {
        return res.status(400).send({ data: null, error:error.message });
    }

    const token = jwt.sign({ id: data.dataValues.id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
    });

    res.status(201).send({
        data: { text: `Student Created with ID: ${data.dataValues.id}`, token },
        error: null,
    });
});

router.put('/:id' , auth ,async (req,res)=>{
    let studentId=parseInt(req.params.id)
    if(req.id!==studentId){
        return res.status(400).send({data:null,error:'Invalid token or Student Does not exists'})
    }

    let validUpdates=['username','password'];
    if(req.body.password){
        req.body.password=parseInt(req.body.password);
        if(req.body.password.length<=5)  return res.status(400).send({data:null,error:'Invalid Form data'});
    }
    const keys=Object.keys(req.body)

    keys.forEach(element => {
        if(validUpdates.indexOf(element)===-1)   return res.status(400).send({data:null,error:'Not a valid update'})
    });

    let [error, data] = await to(
        // db.execQuery(`SELECT * FROM students WHERE id=${studentId}`)
        studentsModel.findAll({
            attributes:['username','password'],
            where:{
                id:studentId
            }
        })
    );
    if (error) return res.status(500).send({ data: null, error:error.errors[0].message });

    let result=data[0];

    keys.forEach(element=>{
        result[element]=req.body[element]
        
    })

    let [err, d]=await to(
        // db.execQuery(`UPDATE students SET username = ? , password = ? WHERE id=${studentId}`,[result['username'],result['password']])
        studentsModel.update(
            {
                username:result['username'],
                password:result['password']
            },
            {
                where:{
                    id:studentId
                }
            })
    )
    if (err) return res.status(500).send({ data: null, error:err.message });

    res.send({data:result,error:null})
})

router.delete('/:id',auth,async(req,res)=>{
    let studentId=parseInt(req.params.id)
    if(req.id!==studentId){
        return res.status(400).send({data:null,error:'Invalid token or Student Does not exists'})
    }

    let [error,data] = await to(studentsModel.destroy({
        where:{
            id:studentId
        }
    }))
    if (error) return res.status(500).send({ data: null, error:error.message });
    
    [error,data] = await to(
        // db.execQuery(`SELECT courseId FROM enrolled_data WHERE studentId=${studentId}`)
        enrolledModel.findAll({
            attributes:['courseId'],
            where:{
                studentId
            }
        })
    )
    if (error) return res.status(500).send({ data: null, error:error.message });
    
    let coursesEnrolled=[];
    data.forEach(element=>{
        coursesEnrolled.push(element.courseId)
    })
    if(coursesEnrolled.length!==0){
        let [err,d] = await to(
            // db.execQuery(`DELETE FROM enrolled_data WHERE studentId=${studentId}`)
            enrolledModel.destroy({
                where:{
                    studentId
                }
            })
        )
        if (err) return res.status(500).send({ data: null, error:err.message});
        [error,data] = await to(
            // db.execQuery(`UPDATE courses SET availableSlots=availableSlots + 1 WHERE id in (${coursesEnrolled})`)
            coursesModel.increment('availableSlots',{
                by:1,
                where:{
                    id:{
                        [Op.in]:coursesEnrolled
                    }
                }
            })
        )
        if (error) return res.status(500).send({ data: null, error:error.message });
    }
    
    res.status(200).send({data:'Success',error:null})
})

module.exports = router;