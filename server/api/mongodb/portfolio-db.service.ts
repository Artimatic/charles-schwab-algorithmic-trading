import * as configurations from '../../config/environment';

const username = configurations.mongodb.username;
const password = configurations.mongodb.password;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.uvlrj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

class PortfolioDbService {

    constructor() { }

    async write(data) {
        try {
            // Connect the client to the server	(optional starting in v4.7)
            await client.connect();
            const dbName = "stock_portfolio";
            const collectionName = "portfolio";

            // Create references to the database and collection in order to run
            // operations on them.
            const database = client.db(dbName);
            const collection = database.collection(collectionName);
            const findOneQuery = { name: '1' };

            const updateDoc = { $set: { date: new Date().toString(), positions: data } };

            // The following updateOptions document specifies that we want the *updated*
            // document to be returned. By default, we get the document as it was *before*
            // the update.
            const updateOptions = { upsert: true };

            try {
                await collection.findOneAndUpdate(
                    findOneQuery,
                    updateDoc,
                    updateOptions,
                );
            } catch (err) {
                console.error(`Something went wrong trying to update one document: ${err}\n`);
            }

        } finally {
            // Ensures that the client will close when you finish/error
            await client.close();
        }
    }
}

export default new PortfolioDbService();