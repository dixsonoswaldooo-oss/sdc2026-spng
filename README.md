# E-Salary Guard

> A one-sentence description of what your project does and who it is for.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | SPNG                                        |
| **Team Domain**        | Domain 2                                    |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth     |
| **Team Leader**        | Dixson Oswaldo Tanjaya                      |
| **University**         | Xiamen University Malaysia                  |
| **Number of Members**  | 5                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/dixsonoswaldooo-oss/sdc2026-spng |
| Live Demo         | https://sdc-2026-spng.replit.app/              |
| RunPod Endpoint   | https://api.runpod.ai/v2/u0u1ewu0meordn        |
| Slide Deck        | https://example.com/slides                     |
| Demo Video        | https://example.com/demo-video                 |

---

## Overview

### Problem

Many small and medium-sized businesses manage employee attendance, overtime, leave, and payroll separately, often relying on manual calculations that can lead to salary errors. Employees may only discover unexpected salary deductions on payday, causing confusion, complaints, and a lack of transparency. HR teams also spend significant time calculating salaries and handling payroll-related issues.

### Solution

e-Salary Guard is an AI-powered payroll management system that automatically calculates employees’ net salaries based on attendance, overtime, bonuses, and leave records. Its AI feature classifies leave requests based on the reasons provided, helping HR review requests more efficiently. The system also provides early WhatsApp-style notifications about salary deductions, transparent salary breakdowns, and activity logs to improve accountability and reduce payroll disputes.

### Key Features

- AI-Powered Leave Classification — Classifies leave requests as tolerated or subject to salary deductions, with confidence scores and HR review.

- Automated Payroll & Salary Insights — Calculates net salaries automatically and provides HR with insights into salary costs, overtime, bonuses, and deductions.

- Early Deduction Notifications — Sends simulated WhatsApp notifications to inform employees about salary deductions, their reasons, and estimated net salaries before payday.

- Transparent Activity Logs — Records salary changes, HR decisions, recalculations, and payroll payments to improve accountability.

- One-Click Payroll Processing — Allows HR to review salary breakdowns and process payroll through a controlled confirmation workflow.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | e.g. HTML, React             |
| Backend       | e.g. Python, Flask / FastAPI |
| Database      | e.g. PostgreSQL, SQLite      |
| AI / Compute  | RunPod (GPU)                 |
| Hosting / Dev | Replit                       |

---

## Project Structure

```
.
├── docs/                    # Screenshots, diagrams
├── runpod/
│   └── handler.py           # RunPod serverless handler (GPU workload)
├── src/
│   ├── main.py              # Application entry point
│   └── utils.py             # Helper functions
├── submission/              # Required submission documents
│   ├── SDC2026_TeamName_Preliminary.pdf      # Preliminary submission
│   ├── SDC2026_TeamName_TechDeclaration.pdf  # Technology declaration
│   ├── SDC2026_TeamName_Replit_POU.pdf       # Replit proof of use
│   └── SDC2026_TeamName_Runpod_POU.pdf       # RunPod proof of use
├── tests/
│   └── test_utils.py        # Unit tests
├── .env.example             # Example environment variables
├── .gitignore
├── .replit                  # Replit run configuration
├── LICENSE
├── requirements.txt         # Python dependencies
└── README.md
```

### Architecture

```
User ──► Replit (App / API) ──► RunPod Endpoint (GPU model)
                │
                └──► Response returned to user
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@your-username/your-project), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY`
   - `RUNPOD_ENDPOINT_ID`
3. Click **Run**. Replit uses the `.replit` file to start `python src/main.py`.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values

# 5. Run the app
python src/main.py
```

### Run Tests

```bash
python -m unittest discover tests
```

---

## How We Use Replit *(Required)*

- **Hosting:** We use Replit to host and deploy our e-Salary Guard web application, making it accessible through our Live Demo link.
- **Development:** Replit serves as our main development environment for building and maintaining the application's code.
- **Configuration:** Environment variables and sensitive credentials are managed through Replit Secrets to avoid exposing API keys in the source code.

📄 Proof of use: [`submission/SDC2026_TeamName_Replit_POU.pdf`](submission/SDC2026_TeamName_Replit_POU.pdf)

## How We Use RunPod *(Required)*

- **GPU Computing:** We use RunPod to provide GPU computing resources for server-side processing and computational workloads that require additional processing power.
- **Server Deployment:** Our GPU workload runs on RunPod's server infrastructure, allowing the application to offload processing tasks from Replit.
- **Integration:** RunPod works alongside our Replit-hosted application to support backend processing using GPU resources.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

📄 Proof of use: [`submission/SDC2026_TeamName_Runpod_POU.pdf`](submission/SDC2026_TeamName_Runpod_POU.pdf)

---

## Challenges & Learnings

- What challenges did you face, and how did you overcome them?

One of the main challenges we faced was coming up with an original idea. Since many of the features we initially considered were already available in Orbyte, we had to narrow down our ideas and focus on features that could provide additional value.

Another challenge was task distribution within the team. We needed to figure out how to divide the workload fairly based on each member's abilities and ensure that everyone could contribute effectively to the project.

We also struggled with learning how to use Replit and RunPod, as this was our first time being required to work with these platforms. Understanding how to set them up and integrate them into our project took time and experimentation.

Additionally, our team had limited prior experience with GitHub and collaborative development. We had to learn how to manage our code, track changes, and work together without creating conflicts.

Despite these challenges, we gradually overcame them by exploring the platforms, testing different approaches, discussing problems as a team, and learning from online documentation and resources.


- What did your team learn?

Throughout this project, we learned the importance of problem-solving, teamwork, and adaptability. We realized that developing a successful project is not only about coming up with creative ideas but also about identifying existing solutions and finding ways to improve upon them.

We also gained practical experience using Replit, RunPod, and GitHub, which helped us better understand the development workflow and the importance of collaboration in building a project.

Most importantly, we learned that communication and proper task distribution are essential for working efficiently as a team. Even when facing unfamiliar technologies and unexpected difficulties, being willing to learn, experiment, and support one another helped us make progress and complete our project.

## Future Improvements

- Enhanced AI Accuracy: Improve the AI model's accuracy and reliability to provide more precise salary-related insights and detect potential payroll discrepancies more effectively.
- Real-Time Payroll Integration: Integrate the system with existing payroll platforms to retrieve up-to-date salary information and automatically identify inconsistencies.
- Stronger Security and Data Privacy: Implement multi-factor authentication, data encryption, and stricter access controls to protect sensitive employee and salary information.
- Personalized Salary Insights: Provide personalized dashboards and reports to help employees better understand their salary breakdowns, deductions, and payment history.
- Scalability and Performance: Optimize the system to handle larger datasets and more users while maintaining fast response times and stable performance.
- Improved User Experience: Enhance the interface to make the system more intuitive, mobile-friendly, and accessible to users with different levels of technical knowledge.

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Dixson Oswaldo Tanjaya | Team Lead / Backend | [@dixsonoswaldooo-oss](https://github.com/dixsonoswaldooo-oss) |
| Gregorius Marvel Wicaksana | Backend / AI           | [@marvelwicaksana-hue](https://github.com/marvelwicaksana-hue) |
| Manuel Otto Chandra | Backend / RunPod         | [@manuism](https://github.com/manuism) |
| Owen Ferdinand Lee | Frontend            | [@owennew2015](https://github.com/owennew2015) |
| Sunu Adi Sotya | Proposal         | [@Sunnadd](https://github.com/Sunnadd) |


---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [ ] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [ ] Submission files renamed with your team name (replace `TeamName`)
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
