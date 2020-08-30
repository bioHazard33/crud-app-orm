const {Sequelize,DataTypes}=require('sequelize')
const client=new Sequelize('mysql://root:1234@localhost:3306/crud-app-orm')

const studentsModel=client.define('students',{
    id:{
        type:Sequelize.INTEGER,
        primaryKey:true,
        autoIncrement:true,
    },
    username:{
        type:Sequelize.STRING,
        unique:true,
        allowNull:false,
    },
    email:{
        type:Sequelize.STRING,
        unique:true,
        allowNull:false
    },
    password:{
        type:Sequelize.STRING,
        allowNull:false
    }
})

const coursesModel=client.define('courses',{
    id:{
        type:Sequelize.INTEGER,
        primaryKey:true,
        autoIncrement:true,
    },
    name:{
        type:Sequelize.STRING,
        allowNull:false,
    },
    description:{
        type:Sequelize.STRING,
        allowNull:false,
    },
    availableSlots:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    enrolledStudents:{
        type:DataTypes.VIRTUAL
    }
})

const enrolledModel=client.define('enrolled_data',{
    studentId:{
        type:Sequelize.INTEGER,
        allowNull:false,
        primaryKey:true
    },
    courseId:{
        type:Sequelize.INTEGER,
        allowNull:false,
        primaryKey:true
    }
})

const dbSync=async ()=>{
    await client.sync();
}

module.exports={dbSync,client,studentsModel,coursesModel,enrolledModel};