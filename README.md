# 🚑 ResponTime AI (Ambufy AI) — Smart EMS Dispatch & Demand Forecasting

An AI-powered Emergency Medical Services (EMS) platform engineered to optimize ambulance allocation and dynamically calculate response times in high-density urban environments.

<img width="1919" height="875" alt="Screenshot 2026-06-08 103900" src="https://github.com/user-attachments/assets/b1d20aa3-61f5-40a1-9cfe-8a6cce0674d3" />

---

## 🛑 Problem Statement
In densely populated and traffic-heavy cities like Dhaka, traditional reactive EMS dispatch models suffer from severe delays. Ambulances are often dispatched from centralized hubs *after* an emergency occurs, leading to fatal wait times due to unpredictable traffic and poor spatial allocation. Furthermore, the lack of structured, historical EMS data makes it difficult to transition to a proactive, predictive model.

The fundamental issue addressed by this project is the severe inefficiency of the existing Emergency Medical Services (EMS) infrastructure in rapidly growing megacities like Dhaka.
* **Reactive and Static Dispatch Models:** The current EMS system relies on a purely reactive approach where ambulances are stationed at fixed locations, such as hospitals or fire stations, and are only dispatched after an emergency call is received. This static deployment completely ignores the dynamic, time-dependent, and unpredictable nature of emergency demand across different urban zones. 
* **Critical Time Delays and the "Golden Hour":** In densely populated areas with extreme traffic congestion, this reactive model leads to fatal delays. In life-threatening scenarios like cardiac arrest or severe trauma, the medical principle of the "Golden Hour" dictates that survival odds decrease by 7–10% for every minute of delay.
* **Resource Misallocation and Operational Saturation:** Without a centralized predictive system, ambulances often sit idle in low-demand areas while high-risk zones experience critical shortages during peak hours. This misallocation results in unnecessary fuel consumption, increased vehicle wear, and significant economic losses for fleet operators. High system utilization without strategic positioning leads to severe response delays.
* **The Data Gap in Developing Cities:** A major roadblock to modernizing EMS in developing regions is the absence of digitized, granular, and publicly available historical EMS data. Without structured data, it is incredibly difficult to train intelligent models that can transition the city from a reactive model to a proactive, predictive one.

## 💡 The Solution
**ResponTime AI** (also operating under the platform name **Ambufy AI**) is a comprehensive, machine learning-driven web platform designed to transform emergency medical services (EMS) from a reactive necessity into a proactive, data-driven framework. By utilizing advanced predictive algorithms, the system forecasts which city zones will experience high emergency demand in the coming hours and dynamically routes idle ambulances to those hotspots *before* emergencies actually happen. Additionally, it provides highly accurate, traffic-adjusted Estimated Times of Arrival (ETA) to both patients and drivers.
### 1. Data-Driven Demand Forecasting & Overcoming Scarcity
* Because Dhaka lacks centralized EMS data, the project utilizes a high-fidelity synthetic dataset. This was generated using probabilistic modeling—specifically the Poisson distribution:

$$P(X=k) = \frac{\lambda^k e^{-\lambda}}{k!}$$

* **What it means:** This is the Probability Mass Function for a Poisson Distribution. It is used to calculate the probability of a given number of events ($k$) occurring in a fixed interval of time or space (e.g., predicting the expected number of emergency calls or customer arrivals within an hour).
* **Variables & Parameters:**
  * $P(X=k)$: The probability of exactly $k$ events occurring.
  * $\lambda$ (Lambda): The average rate or expected value of occurrences.
  * $e$: Euler's number (approximately 2.71828).
  * $k!$: The factorial of $k$ (e.g., $3! = 3 \times 2 \times 1$).

  Inspired by San Francisco Fire Department statistics, this model was carefully adapted to Dhaka's unique population density, traffic conditions, and 20 specific administrative zones. 

* The system utilizes advanced feature engineering, incorporating cyclical temporal encoding (such as hour of the day and day of the week), lag features, and rolling statistics to capture dynamic spatial and temporal demand patterns. 

### 2. Dual Machine Learning Architecture
* **Demand Prediction (LightGBM):** The core of the proactive deployment is a Light Gradient Boosting Machine (LightGBM) model. Outperforming traditional linear models and neural networks, this model achieved an $R^2$ score of approximately 0.70. It successfully forecasts hourly ambulance demand across the city, identifying non-linear patterns like morning and evening traffic peaks or demographic shifts.
* **ETA and Routing (CatBoost):** To provide highly accurate, traffic-adjusted Estimated Times of Arrival (ETA), the system employs a CatBoost regression model. Furthermore, to calculate realistic travel paths in Dhaka's grid-like road network, the system uses the Manhattan Distance formula:

$$D(A,B) = |x_2 - x_1| + |y_2 - y_1|$$

* **What it means:** This represents the Manhattan Distance (or City Block Distance) formula. It is used to calculate the distance between two points on a grid-based map—following grid lines rather than a direct diagonal path, which closely mirrors navigation through urban street layouts. It is widely used in data science and machine learning applications.
* **Variables & Parameters:**
  * $D(A,B)$: The distance between point A and point B.
  * $(x_1, y_1)$: Coordinates of point A.
  * $(x_2, y_2)$: Coordinates of point B.
  * $|...|$: Absolute value operator (ensuring the difference is treated as positive regardless of sign).

  This provides a much more reliable routing basis than direct Euclidean distance.

### 3. Proactive Ambulance Allocation (Queuing Theory)
* Instead of waiting for emergencies, the system uses a proportional distribution model to dynamically pre-position idle ambulances into high-risk zones before demand spikes. 
* The allocation formula:

$$A_z = \frac{D_z}{\sum D_z} \times A_{total}$$

* **What it means:** This formula is used for proportional allocation to distribute a total resource pool among different categories or zones based on their respective demand weights. In this project, it dynamically pre-positions idle ambulances to high-risk zones proportional to their forecasted demand.
* **Variables & Parameters:**
  * $A_z$: The allocated resource amount for zone $z$.
  * $D_z$: The specific demand or weight for zone $z$.
  * $\sum D_z$: The total sum of demands across all zones.
  * $A_{total}$: The total available amount of resources to be distributed (e.g., total active ambulance fleet).

  This formula ensures that zones with higher predicted demand receive a larger share of the total available fleet. This drastically cuts down the distance an ambulance must travel to reach a patient, reducing expected response times by 15–30% during peak hours.

### 4. Three-Tier Web Application Interface
* **Patient Interface:** A frictionless, one-tap "Call Ambulance Now" button automatically detects the patient's location via geolocation APIs. It provides real-time GPS tracking of the dispatched ambulance, an AI-calculated ETA, automated routing to the nearest suitable hospital, and payment integration via bKash or cash.
* **Driver Portal:** A milestone-driven workflow (Arrived, Start Trip, End Trip) that provides drivers with turn-by-turn navigation and instant notifications of incoming emergencies.
* **Admin Dashboard:** A centralized command center featuring an AI-powered predictive heatmap. It categorizes city zones into High, Medium, and Low risk, allowing dispatchers to monitor the live fleet and execute AI-recommended fleet rebalancing strategies to prevent regional shortages

---

## ✨ Core Features
*   **Proactive Demand Forecasting:** AI-driven heatmaps allow admins to visualize high-risk zones and rebalance the fleet dynamically.
*   **Dynamic ETA Calculation:** Traffic and spatial-aware algorithms provide accurate arrival times rather than simple straight-line estimates.
*   **Real-Time Fleet Tracking:** WebSockets and geospatial mapping provide live monitoring of all active ambulances.
*   **Role-Based Access:** Dedicated interfaces for Patients (one-tap dispatch), Drivers (navigation & status management), and Admins (fleet oversight).

---

## 📊 Dataset & Machine Learning Pipeline

A critical challenge in developing this system was the scarcity of open-source, historical EMS logs for Dhaka. To overcome this, a highly realistic simulation dataset was engineered, and two specialized machine learning models were trained.

### 1. The Dataset (`dhaka_ambulance_high_demand_dataset.csv`)
*   **Data Generation:** The dataset was synthesized using statistical modeling, specifically leveraging the **Poisson distribution**, to simulate realistic emergency call frequencies across different time intervals.
*   **Spatial Mapping:** The data maps to 20 distinct administrative zones within Dhaka, incorporating real-world urban parameters.
*   **Features Included:** Time of Day, Day of the Week, Weather Conditions, Historical Trip Frequency, Traffic Density Factors, and specific Pick-up/Drop-off coordinates.

### 2. Model Training: Demand Forecasting (LightGBM)
*   **Algorithm:** `LightGBM Regressor` (Light Gradient Boosting Machine).
*   **Why LightGBM?** Chosen for its high efficiency and accuracy in handling large, tabular datasets with complex categorical features (like specific city zones and weather conditions) without requiring extensive one-hot encoding.
*   **Training Process:** The dataset was split into training and testing sets. Categorical features were encoded, and the model was trained to predict the intensity of ambulance demand for specific zones in future time windows.
*   **Performance:** The model achieved an impressive **R² score of ~0.70**, indicating a strong correlation between the predicted hotspots and the simulated real-world demand.
*   **Output:** The serialized model (`lgbm_demand_model.pkl`) is loaded into the FastAPI backend to generate live predictive heatmaps on the Admin Dashboard.
<img width="1946" height="792" alt="image" src="https://github.com/user-attachments/assets/16f08735-b889-40de-92db-9d0dbbbdf41d" />

<img width="1781" height="989" alt="image" src="https://github.com/user-attachments/assets/1f95d4c5-ed38-46b7-b69f-280f6a6f283e" />

### 3. Model Training: Dynamic ETA Calculation (CatBoost)
* **Algorithm:** CatBoost Regressor (Categorical Boosting).
* **Why CatBoost?** It achieved the highest performance among all tested models for ETA prediction with an **$R^2$ score of 0.8262**, an MAE of **3.48**, and an RMSE of **6.60**. It is highly robust against overfitting and exceptionally fast during inference, which is crucial for calculating live ETAs when a patient requests an ambulance.
* **Distance Formulation:** Because Dhaka relies on a grid-like road network rather than direct point-to-point travel, the model utilizes the Manhattan Distance metric alongside coordinates, rather than simple Euclidean distance.
* **Training Process:** The model was trained using a large dataset (training shape: $1,750,074 \times 10$) incorporating Pick-up/Drop-off coordinates, the calculated Manhattan distance, the hour of the day, and a dynamic zone traffic factor to regress the final travel time.
* **Output:** The serialized model (`catboost_eta_model.pkl`) instantly responds to patient requests via the API to display the accurate arrival timer.
<img width="942" height="540" alt="image" src="https://github.com/user-attachments/assets/0dffbe79-6aaa-421d-a748-3d23d87b47f1" />

---

## 🛠️ Tech Stack

**Frontend (Client & Admin Apps):**
*   **Framework:** React 19 (Vite)
*   **Styling:** Tailwind CSS
*   **Mapping:** React-Leaflet (Leaflet.js)
*   **Icons & Routing:** Lucide-React, React-Router-Dom

**Backend (API & WebSockets):**
*   **Framework:** FastAPI (Python 3) & Uvicorn
*   **Data Processing:** Pandas, NumPy, Scikit-Learn
*   **Machine Learning:** LightGBM, CatBoost, Joblib

**Database & Auth:**
*   **BaaS:** Supabase (PostgreSQL, Realtime, Authentication)

---

## 🏗️ System Architecture

### High-Level Workflow
1.  **Patient Request:** A user taps "Request Ambulance". GPS coordinates are captured.
2.  **API Routing:** FastAPI receives the request and queries Supabase for the nearest `available` driver.
3.  **Inference Engine:** The CatBoost model calculates the exact ETA based on live traffic factors.
4.  **Dispatch:** The assigned driver receives a notification. Once accepted, their status changes to `busy`, and live WebSockets stream their location to the patient's map.
5.  **Admin Rebalancing:** Simultaneously, the Admin dashboard queries the LightGBM model to update the city heatmap, ensuring no zone is left without coverage.
<img width="1900" height="877" alt="Screenshot 2026-04-14 225218" src="https://github.com/user-attachments/assets/f276bf6f-9569-4d79-a11d-14daab885283" />

<img width="1920" height="1080" alt="Screenshot (560)" src="https://github.com/user-attachments/assets/e896b02c-a579-4a6e-a4ea-ec213cdeafa3" />
<img width="1920" height="1080" alt="Screenshot (561)" src="https://github.com/user-attachments/assets/53807bdb-711a-4859-92ec-2580c59d164d" />
<img width="1920" height="1080" alt="Screenshot (562)" src="https://github.com/user-attachments/assets/b4e08625-5a50-48b5-ab7f-becc70cfbc11" />
<img width="993" height="561" alt="Screenshot 2026-04-15 073525" src="https://github.com/user-attachments/assets/9acdd0c2-79c6-4b7b-93d1-9f0b1da26a1c" />

---

## 📡 API Endpoints (Core)

| Method | Endpoint | Functionality |
| :--- | :--- | :--- |
| `POST` | `/routers/prediction/predict-demand` | Inputs zone/time data; returns expected demand level via LightGBM. |
| `POST` | `/routers/prediction/calculate-eta` | Inputs start/end coordinates; returns ETA via CatBoost. |
| `GET` | `/routers/fleet/status` | Fetches live location and availability of all fleet vehicles. |
| `POST` | `/routers/patients/request` | Creates a new emergency log and matches the nearest driver. |

## ⚙️ Installation & Local Setup

### Prerequisites
*   Node.js (v18+)
*   Python (v3.13)
*   A Supabase Project

### For Clone the Repository
```bash
git clone [https://github.com/your-username/respon-time-ai.git](https://github.com/your-username/respon-time-ai.git)
cd respon-time-ai


