const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../lib/mysql/mysql");
const { to } = require("await-to-js");
const {
    client,
    coursesModel,
    enrolledModel,
} = require("../lib/mysql/sequelize");

// Get all courses
router.get("/", async (req, res) => {
    let [error, data] = await to(coursesModel.findAll());
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    res.status(200).send({ data, error: null });
});

// Get Specific Course
router.get("/:id", async (req, res) => {
    let courseId = parseInt(req.params.id);
    let [error, data] = await to(
        coursesModel.findAll({
            where: {
                id: courseId,
            },
        })
    );

    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    if (data.length == 0)
        return res
            .status(400)
            .send({ data: null, error: `No Course with ID: ${courseId}` });
    let result = data[0];

    [error, data] = await to(
        client.query(
            `SELECT students.id,students.username from students INNER JOIN enrolled_data ON students.id=enrolled_data.studentId where enrolled_data.courseId=${courseId}`,
            { type: client.QueryTypes.SELECT }
        )
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });
    result.enrolledStudents = data;
    res.send({ data: result, error: null });
});

// Add course
router.post("/", auth, async (req, res) => {
    if (req.id !== parseInt(process.env.ADMIN_ID)) {
        res.status(400).send({ data: null, error: "Only admin add a course" });
    }

    let name, description, availableSlots;
    try {
        (name = req.body.name.trim()),
            (description = req.body.description.trim()),
            (availableSlots = parseInt(req.body.availableSlots));
    } catch (e) {
        return res.status(400).send({ data: null, error: `Invalid Form Data` });
    }

    if (!name || !description || !availableSlots || availableSlots <= 0)
        return res.status(400).send({ data: null, error: `Invalid Form Data` });

    let course = {
        name,
        description,
        availableSlots,
    };

    let [error, data] = await to(coursesModel.create(course));

    if (error) {
        return res.status(400).send({ data: null, error });
    }
    res.status(201).send({
        data: `Course create with ID: ${data.dataValues.id}`,
        error: null,
    });
});

//Enroll in course
router.post("/:id/enroll", auth, async (req, res) => {
    let courseId = parseInt(req.params.id),
        studentId = parseInt(req.body.studentId);

    if (
        (req.id !== parseInt(process.env.ADMIN_ID) && req.id !== studentId) ||
        studentId === parseInt(process.env.ADMIN_ID)
    )
        return res.status(401).send({
            data: null,
            error: "Invalid Token or Student does not Exists",
        });

    let [error, data] = await to(
        // db.execQuery(`SELECT * FROM courses WHERE id=${courseId}`)
        coursesModel.findAll({
            where: {
                id: courseId,
            },
        })
    );
    if (error) return res.status(500).send({ data: null, error:error.message });

    if (data.length == 0)
        return res
            .status(400)
            .send({ data: null, error: `No Course with ID: ${courseId}` });

    let available_slots = data[0].availableSlots;

    [error, data] = await to(
        // `SELECT * FROM enrolled_data WHERE studentId=${studentId} AND courseId=${courseId}`
        enrolledModel.findAll({
            where: {
                courseId,
                studentId,
            },
        })
    );
    if (error) return res.status(500).send({ data: null, error });
    if (data.length > 0)
        return res.status(400).send({
            data: null,
            error: `Student with ID: ${studentId} already enrolled in Course with ID: ${courseId}`,
        });

    if (available_slots <= 0)
        return res
            .status(400)
            .send({ data: null, error: `No available Slots` });

    available_slots--;

    [err, d] = await to(
        // `UPDATE courses SET availableSlots=${available_slots} WHERE id=${courseId}`
        coursesModel.update(
            { availableSlots:available_slots },
            {
                where: {
                    id: courseId,
                },
            }
        )
    );
    if (err) return res.status(500).send({ data: null, error: err.errors[0].message });
    [error, data] = await to(
        // `INSERT INTO enrolled_data SET ?`, {
        //     courseId,
        //     studentId,
        // }
        enrolledModel.create({ courseId, studentId })
    );
    if (error)
        res.status(500).send({ data: null, error: error.message });

    res.status(201).send({ data: "Success", error: null });
});

//Deregister from a Course
router.put("/:id/deregister", auth, async (req, res) => {
    let courseId = parseInt(req.params.id),
        studentId = parseInt(req.body.studentId);

    if (req.id !== parseInt(process.env.ADMIN_ID) && req.id !== studentId)
        return res.status(401).send({
            data: null,
            error: "Invalid Token or Student does not Exists",
        });

    let [error, data] = await to(
        // db.execQuery(`SELECT * FROM courses WHERE id=${courseId}`)
        coursesModel.findAll({ id: courseId })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    if (data.length == 0)
        return res
            .status(400)
            .send({ data: null, error: `No Course with ID: ${courseId}` });

    let available_slots = data[0].availableSlots;

    [error, data] = await to(
        // db.execQuery(`SELECT * FROM enrolled_data WHERE studentId=${studentId} AND courseId=${courseId}`)
        enrolledModel.findAll({
            where: {
                studentId,
                courseId,
            },
        })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });
    if (data.length == 0)
        return res.status(400).send({
            data: null,
            error: `Student with ID: ${studentId} not enrolled in Course with ID: ${courseId}`,
        });

    available_slots++;

    [error, data] = await to(
        // db.execQuery(
        //     `UPDATE courses SET availableSlots=${available_slots} WHERE id=${courseId}`
        // )
        coursesModel.update(
            { availableSlots: available_slots },
            {
                where: {
                    id: courseId,
                },
            }
        )
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.errors[0].message });

    [error, data] = await to(
        // db.execQuery(
        //     `DELETE FROM enrolled_data WHERE courseId=${courseId} AND studentId=${studentId}`
        // )
        enrolledModel.destroy({
            where: {
                courseId,
                studentId,
            },
        })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    res.status(201).send({ data: "Success", error: null });
});

/* {
    "data": {
        "fieldCount": 0,
        "affectedRows": 1,
        "insertId": 0,
        "serverStatus": 2,
        "warningCount": 0,
        "message": "",
        "protocol41": true,
        "changedRows": 0
    }
    * This is sample response of DB
*/
router.put("/:id", auth, async (req, res) => {
    let courseId = parseInt(req.params.id);

    if (req.id !== parseInt(process.env.ADMIN_ID)) {
        res.status(400).send({
            data: null,
            error: "Only admin can change course details",
        });
    }
    let validUpdates = ["name", "description", "availableSlots"];

    const keys = Object.keys(req.body);

    keys.forEach((element) => {
        if (validUpdates.indexOf(element) === -1)
            return res
                .status(400)
                .send({ data: null, error: "Not a valid update" });
    });
    if (req.body.availableSlots) {
        req.body.availableSlots = parseInt(req.body.availableSlots);
        if (req.body.availableSlots <= 0)
            return res
                .status(400)
                .send({ data: null, error: "Invalid Form data" });
    }

    let [error, data] = await to(
        // db.execQuery(`SELECT * FROM courses WHERE id=${courseId}`)
        coursesModel.findAll({
            where: {
                id: courseId,
            },
        })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    if (data.length == 0)
        return res
            .status(400)
            .send({ data: null, error: `No Course with ID: ${courseId}` });

    let result = data[0];

    keys.forEach((element) => {
        result[element] = req.body[element];
    });

    let [err, d] = await to(
        // db.execQuery(`UPDATE courses SET name = ? , description = ? , availableSlots = ? WHERE id=${courseId}`,[result['name'],result['description'],result['availableSlots']])

        coursesModel.update(
            {
                name: result["name"],
                description: result["description"],
                availableSlots: result["availableSlots"],
            },
            {
                where: {
                    id: courseId,
                },
            }
        )
    );
    if (err)
        return res
            .status(500)
            .send({ data: null, error: err.message });

    res.send({ data: result, error: null });
});

router.delete("/:id", auth, async (req, res) => {
    let courseId = parseInt(req.params.id);
    if (req.id !== parseInt(process.env.ADMIN_ID))
        res.status(400).send({
            data: null,
            error: "Only admin can delete a course",
        });

    let [error, data] = await to(
        // db.execQuery(`DELETE FROM courses WHERE id=${courseId}`)
        coursesModel.destroy({
            where: {
                id: courseId,
            },
        })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    if (data.affectedRows == 0)
        return res
            .status(400)
            .send({ data: null, error: `No Course with ID: ${courseId}` });

    [error, data] = await to(
        // db.execQuery(`DELETE from enrolled_data WHERE courseId=${courseId}`)
        enrolledModel.destroy({
            where: {
                courseId,
            },
        })
    );
    if (error)
        return res
            .status(500)
            .send({ data: null, error: error.message });

    res.send({ data: "Success", error: null });
});

module.exports = router;
