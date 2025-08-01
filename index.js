import dotenv from 'dotenv';
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
  userId: String,
  amount: Number,
  remark: String,
  spentFromState: String,
  date: { type: Date, default: Date.now }
})
const TransactionsSchema = mongoose.Schema({
  userId: String,
  amount: Number,
  remark: String,
  medium: String,
  date: { type: Date, default: Date.now }
});

const SavingsSchema = mongoose.Schema({
  userId: String,
  name: String,
  amount: Number,
  medium: String,
  date: { type: Date, default: Date.now },
  index: Number
});


const BalanceSchema = mongoose.Schema({
  userId: String,
  OnlineBalance: Number,
  OfflineBalance: Number,
  TotalBalance: Number,
});


const SavingsData = mongoose.model('SavingsData', SavingsSchema);
const BalanceData = mongoose.model('BalanceData', BalanceSchema);
const TransactionsData = mongoose.model('TransactionsData', TransactionsSchema);
const ExpenseData = mongoose.model('ExpenseData', ExpenseDataSchema);

app.get('/', (req, res) => {
  res.json({ message: 'working' });
});

//function saveExpenseData(objData)
app.post('/api/save/ExpenseData', async (req, res) => {
  try {
    const { amount, remark, spentFromState } = req.body;
    const newExpenseData = new ExpenseData({
      amount,
      remark,
      spentFromState
    });
    const savedExpenseData = await newExpenseData.save();
    res.status(200).json({ message: 'Expense data saved successfully' }, savedExpenseData);
  } catch (error) {
    console.error('Error saving expense data:', error);
    res.status(500).json({ message: 'Error saving expense data' }, error);
  }

});

//export function getExpenseData(DataName)
app.get('/api/get/ExpenseData', async (req, res) => {
  try {
    const expenseData = await ExpenseData.find();
    res.status(200).json(expenseData);
  } catch (error) {
    console.error('Error fetching expense data:', error);
    res.status(500).json({ message: 'Error fetching expense data' }, error);
  }
});

//export function setTransactions(DataObject)
app.post('/api/save/setTransactions', async (req, res) => {
  try {
    const { amount, remark, medium } = req.body;
    const newTransaction = new TransactionsData({
      amount,
      remark,
      medium
    });
    const savedTransaction = await newTransaction.save();
    res.status(200).json({ message: 'Transaction saved successfully' }, savedTransaction);
  } catch (error) {
    console.error('Error saving transactions:', error);
    res.status(500).json({ message: 'Error saving transactions' }, error);
  }
});

//export function getTransactions()
app.get('/api/get/TransactionsData', async (req, res) => {
  try {
    const transactionsData = await TransactionsData.find().sort({ createdAt: -1 });
    res.status(200).json(transactionsData);
  } catch (error) {
    console.error('Error fetching transactions data:', error);
    res.status(500).json({ message: 'Error fetching transactions data' }, error);
  }
});

//Balance API
//AddOnlineBalance(BalanceData),
//AddOfflineBalance(BalanceData)
app.post('/api/save/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { OnlineBalance, OfflineBalance, TotalBalance } = req.body;
    const UpdatedTotalBalance = OnlineBalance + OfflineBalance;

    // update or create balance data
    const existingBalanceData = await BalanceData.findOne({ userId });
    if (existingBalanceData) {
      existingBalanceData.OnlineBalance = OnlineBalance;
      existingBalanceData.OfflineBalance = OfflineBalance;
      existingBalanceData.TotalBalance = UpdatedTotalBalance;
      await existingBalanceData.save();
      return res.status(200).json({ message: 'Balance data updated successfully' }, existingBalanceData);
    }

    const newBalanceData = new BalanceData({
      userId,
      OnlineBalance,
      OfflineBalance,
      UpdatedTotalBalance
    });

    const savedBalanceData = await newBalanceData.save();
    res.status(200).json({ message: 'Balance data saved successfully' }, savedBalanceData);
  } catch (error) {
    console.error('Error saving balance:', error);
    res.status(500).json({ message: 'Error fetching balance' }, error);
  }
});


//getTotalBalance()
//getOnlineBalance()
//getOfflineBalance()
app.get('/api/get/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const balanceData = await BalanceData.findOne({ userId });
    if (!balanceData) {
      return res.status(404).json({ message: 'Balance data not found' });
    }
    res.status(200).json(balanceData);
  } catch (error) {
    console.error('Error fetching balance data:', error);
    res.status(500).json({ message: 'Error fetching balance data' }, error);
  }
});

//Savings API
//AddSavingsData(savingsData)
app.post('/api/save/savings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, amount, medium } = req.body;
    const count = await SavingsData.countDocuments({ userId }); // Get the next index for the savings data
    const i = (count + 1) || 1; // Use the count as the index
    const newSavingsData = new SavingsData({
      userId,
      name,
      amount,
      medium,
      index: i
    });
    const savedSavingsData = await newSavingsData.save();
    res.status(200).json({ message: 'Savings data saved successfully' }, savedSavingsData);
  } catch (error) {
    console.error('Error saving savings data:', error);
    res.status(500).json({ message: 'Error saving savings data' }, error);
  }
});

//getSavingsData()
app.get('/api/get/savings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { i } = req.query;

    if (!i) {
      const savingsData = await SavingsData.find({ userId });
      if (!savingsData) {
        return res.status(404).json({ message: 'Savings data not found' });
      }
      return res.status(200).json(savingsData);
    }
    const savingsData = await SavingsData.findOne({ userId, index: i });
    return res.status(200).json(savingsData);
  } catch (error) {
    console.error('Error fetching savings data:', error);
    res.status(500).json({ message: 'Error fetching savings data' }, error);
  }
});

//removeSavingsElement(i)
app.delete('/api/delete/savings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { i } = req.body;
    const deletedSavingsData = await SavingsData.deleteOne({ userId, index: i });
    // Check if any savings data was deleted
    if (deletedSavingsData.deletedCount === 0) {
      return res.status(404).json({ message: 'No savings data found for this user' });
    }
    res.status(200).json({ message: 'Savings data deleted successfully' }, deletedSavingsData);
  } catch (error) {
    console.error('Error deleting savings data:', error);
    res.status(500).json({ message: 'Error deleting savings data' }, error);
  }
});

//updateSavingsElement(index,newData)
app.patch('/api/update/savings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);
    const { i, name, amount, medium } = req.body;
    const updatedSavingsData = await SavingsData.findOneAndUpdate(
      { userId, index: i },
      { name, amount, medium },
      { new: true }
    );
    if (!updatedSavingsData) {
      return res.status(404).json({ message: 'Savings data not found' });
    }
    res.status(200).json({ message: 'Savings data updated successfully' }, updatedSavingsData);
  } catch (error) {
    console.error('Error updating savings data:', error);
    res.status(500).json({ message: 'Error updating savings data' }, error);
  }
});
//start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

