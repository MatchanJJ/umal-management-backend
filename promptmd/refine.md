You already implemented the AssignAI dataset generation and training scripts, but we need to **restructure both the dataset and the model** based on updated requirements.

Updates:

1. **Role is removed**  
   - All members can perform all roles.  
   - Do not include any “role” or “preferred_role” columns in the dataset or training.  
   - Focus only on availability, fairness, and participation history.

2. **Dataset Structure**  
   Columns should be:

   - member_id: unique identifier (M001–M010)  
   - is_available: 1 = available for the event, 0 = not available  
   - assignments_last_7_days: number of events participated in last 7 days  
   - assignments_last_30_days: number of events participated in last 30 days  
   - days_since_last_assignment: days since last assigned event  
   - attendance_rate: float between 0.6 and 1.0 representing reliability  
   - event_size: number of volunteers needed  
   - event_date: YYYY-MM-DD  
   - assigned: target label, 1 if assigned, 0 otherwise  

   - Generate at least 200 rows, randomized realistically.  
   - Ensure 'assigned' is only 1 if is_available = 1.

3. **Model Training**  
   - Features: all columns except member_id and assigned.  
   - Target: assigned  
   - Convert event_date into numeric feature (day of week or ordinal)  
   - Scale numerical features as needed  
   - Train a supervised model (RandomForestClassifier or XGBoost)  
   - Train-test split: 80/20  
   - Output accuracy and classification report  
   - Save trained model as "assignai_model.pkl"

4. **Code Requirements**  
   - Modular and reusable  
   - Dataset generation and training should be separate functions/scripts  
   - Ready for integration with the Python microservice in AssignAI  

**Task:**  
- Refactor your existing scripts according to these updates.  
- Generate a clean, updated CSV dataset.  
- Train the model on the new dataset.  
- Save the model for inference.
