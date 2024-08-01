import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

export default async ({ req, res }) => {
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID);

  const databases = new Databases(client);

  if (req.method === 'GET') {
    const userId = req.query.userId;

    try {
      // fetch all todos
      const todos = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        process.env.APPWRITE_COLLECTION_ID,
        [Query.equal('userId', userId), Query.orderAsc('order')]
      );

      // separate todos by status
      const statusCategories = {
        todo: [],
        doing: [],
        review: [],
        completed: [],
      };

      todos.documents.forEach((todo) => {
        if (todo.status.toLowerCase() in statusCategories) {
          statusCategories[todo.status.toLowerCase()].push(todo);
        }
      });

      // update order based on offset value
      const updateOrder = (todos, offset = 100) => {
        return todos.map((todo, index) => {
          todo.order = (index + 1) * offset;
          return todo;
        });
      };

      // update order for each category
      statusCategories.todo = updateOrder(statusCategories.todo);
      statusCategories.doing = updateOrder(statusCategories.doing);
      statusCategories.review = updateOrder(statusCategories.review);
      statusCategories.completed = updateOrder(statusCategories.completed);

      // flatten the updated todos array
      const updatedTodos = [
        ...statusCategories.todo,
        ...statusCategories.doing,
        ...statusCategories.review,
        ...statusCategories.completed,
      ];

      // array to store the latest updated todos
      const latestUpdatedTodos = [];

      // update each todo in the database
      for (const todo of updatedTodos) {
        const document = await databases.updateDocument(
          process.env.APPWRITE_DATABASE_ID,
          process.env.APPWRITE_COLLECTION_ID,
          todo.$id,
          {
            order: todo.order,
          }
        );
        latestUpdatedTodos.push(document);
      }

      return res.json({
        success: true,
        message: 'Order fields updated successfully',
        updatedTodos: latestUpdatedTodos,
      });
    } catch (error) {
      return res.json({
        success: false,
        message: 'Failed to update order fields',
        error: error.message,
      });
    }
  }
};
