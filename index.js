const express = require("express");
const usersRoute = require("./routes/students");
const coursesRoute = require("./routes/courses");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/students/", usersRoute);
app.use("/api/courses/", coursesRoute);

app.listen(PORT, (req, res) => {
    console.log(`Server started on PORT ${PORT}`);
});
