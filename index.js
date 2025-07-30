import dotenv from 'dotenv';
import e from 'express';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT;
// console.log(PORT, MONGO_URI);


//connect to mongodb
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    })
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((error) => {
    console.error('MongoDB connection error:', error);
});

const app = express();
app.use(express.json());

const ExpenseDataSchema = mongoose.Schema({
  amount: Number,
  remark: String,
  spentFromState: String,
})
const TransactionsSchema = mongoose.Schema({
  amount: Number,
  remark: String,
  medium: String,
  // date: { type: Date, default: Date.now }
});

const TransactionsData = mongoose.model('TransactionsData', TransactionsSchema);
const ExpenseData = mongoose.model('ExpenseData', ExpenseDataSchema);

app.get('/', (req, res) => {
  res.json({ message: 'working' });
});

//function saveExpenseData(objData)
app.post('/api/save/ExpenseData', async(req, res) => {
  try{
    const {amount,remark,spentFromState} = req.body; 
    const newExpenseData = new ExpenseData({
      amount,
      remark,
      spentFromState
    });
    const savedExpenseData = await newExpenseData.save();
    res.status(200).json({ message: 'Expense data saved successfully' },savedExpenseData);
  }catch (error) {
    console.error('Error saving expense data:', error);
    res.status(500).json({ message: 'Error saving expense data' },error);
  }
  
});

//export function getExpenseData(DataName)
app.get('/api/get/ExpenseData', async(req, res) => {
  try {
    const expenseData = await ExpenseData.find();
    res.status(200).json(expenseData);
  } catch (error) {
    console.error('Error fetching expense data:', error);
    res.status(500).json({ message: 'Error fetching expense data' },error);
  }
});

//export function setTransactions(DataObject)
app.post('/api/save/setTransactions', async(req, res) => {
  try{
    const {amount, remark, medium} = req.body;
    const newTransaction = new TransactionsData({
      amount,
      remark,
      medium
    });
    const savedTransaction = await newTransaction.save();
    res.status(200).json({ message: 'Transaction saved successfully' }, savedTransaction);
  }catch (error) {
    console.error('Error saving transactions:', error);
    res.status(500).json({ message: 'Error saving transactions' },error);
  }
});

//export function getTransactions()
app.get('/api/get/TransactionsData', async(req, res) => {
  try {
    const transactionsData = await TransactionsData.find().sort({createdAt: -1});
    res.status(200).json(transactionsData);
  } catch (error) {
    console.error('Error fetching transactions data:', error);
    res.status(500).json({ message: 'Error fetching transactions data' },error);
  }
});

//Balance API

//start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

