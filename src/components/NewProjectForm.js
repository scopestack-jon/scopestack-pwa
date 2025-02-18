import React, { useState, useEffect, useCallback } from 'react';
import {
  searchClients,
  fetchQuestionnaires,
  fetchQuestionnaireQuestions,
  createClient,
  createProject,
  getCurrentUserAndAccount,
  fetchDefaultRateTable,
  fetchDefaultPaymentTerm,
  executeSurveyWorkflow,
  executeDocumentWorkflow,
  fetchProjectPricing,
  generateContentWithAI,
  fetchProjectServices,
} from '../services/api';
import './NewProjectForm.css';
import ExecutiveSummary from './ExecutiveSummary';

const NewProjectForm = () => {
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [msaDate, setMsaDate] = useState('');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState('');
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [rateTableId, setRateTableId] = useState(null);
  const selectedPaymentTerm = {
    id: "3017",
    type: "payment-terms",
    attributes: {
      active: true,
      name: "FF, 2 Payments (25/75), Services Only",
      "pricing-model": "fixed_fee",
      slug: "ff_2_payments_2575_services_only",
      position: 7,
      rounding: "1234.57",
      default: true,
      "include-expense-in-cost": true,
      "include-expense-in-revenue": true,
      "travel-limit": false,
      "include-materials": false
    }
  };

  const [accountId, setAccountId] = useState(null);
  const [accountName, setAccountName] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactTitle, setContactTitle] = useState('');

  const [filteredClients, setFilteredClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  // Add new state for loading and status messages
  const [statusMessage, setStatusMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [projectServices, setProjectServices] = useState([]);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const [projectId, setProjectId] = useState(null);

  const [loading, setLoading] = useState(false);

  const handleClientSearch = async (searchTerm) => {
    if (searchTerm.trim() === '') {
      setFilteredClients([]);
      return;
    }

    try {
      const response = await searchClients(searchTerm);
      const clients = response.data || [];
      setFilteredClients(clients);
    } catch (error) {
      console.error('Error searching clients:', error);
      setFilteredClients([]);
    }
  };

  const handleClientInputChange = (e) => {
    const searchTerm = e.target.value;
    setClientName(searchTerm);
    if (searchTerm.length >= 2) {
      handleClientSearch(searchTerm);
    } else {
      setFilteredClients([]);
    }
  };

  const handleClientSelect = (client) => {
    setClientName(client.attributes.name);
    setSelectedClient(client);
    setFilteredClients([]);
  };

  const handleAnswerChange = (questionSlug, value, questionId) => {
    setAnswers((prevAnswers) => ({
      ...prevAnswers,
      [questionSlug]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsLoading(true);
      // Validate all required fields
      if (!projectName.trim()) {
        throw new Error('Project name is required.');
      }
      if (!selectedPaymentTerm || !selectedPaymentTerm.id) {
        console.log('Selected Payment Term:', selectedPaymentTerm);
        throw new Error('Payment term is required.');
      }
      if (!rateTableId) {
        throw new Error('Rate table is required.');
      }
      if (!accountId) {
        throw new Error('Account ID is required.');
      }

      // Handle client creation/selection
      let clientId;
      if (selectedClient) {
        clientId = selectedClient.id;
      } else if (clientName.trim()) {
        // Create new client if name is provided
        const newClient = await createClient(clientName, accountId);
        clientId = newClient.data.id;
      } else {
        throw new Error('Please select an existing client or enter a new client name.');
      }

      const projectData = {
        data: {
          type: 'projects',
          attributes: {
            'project-name': projectName.trim(),
            'msa-date': msaDate || null
          },
          relationships: {
            account: {
              data: {
                type: 'accounts',
                id: accountId.toString()
              }
            },
            client: {
              data: {
                type: 'clients',
                id: clientId.toString()
              }
            },
            'payment-term': {
              data: {
                type: 'payment-terms',
                id: "3017"
              }
            },
            'rate-table': {
              data: {
                type: 'rate-tables',
                id: rateTableId.toString()
              }
            }
          }
        }
      };

      // Debug logging
      console.log('Project Data Being Sent:', JSON.stringify(projectData, null, 2));

      const project = await createProject(projectData);
      setStatusMessage('Project created. Processing survey...');

      if (project.data && project.data.id) {
        // Format the responses from the answers state
        const formattedResponses = Object.entries(answers).map(([questionSlug, answer]) => {
          const question = questions.find(q => q.slug === questionSlug);
          return {
            'question-id': question.id,
            'question': question.question,
            'answer': answer
          };
        });

        // Create survey data with responses
        const surveyData = {
          name: `Survey for ${projectName}`,
          contactName: contactName || 'Unknown',
          contactEmail: contactEmail || 'unknown@example.com',
          accountId: accountId,
          responses: formattedResponses
        };

        // Execute survey workflow
        setStatusMessage('Creating and processing survey...');
        await executeSurveyWorkflow(project.data.id, selectedQuestionnaire, surveyData);

        // Generate and poll for document
        setStatusMessage('Generating document...');
        const documentResult = await executeDocumentWorkflow(project.data.id);
        setDocumentUrl(documentResult.documentUrl);
        setStatusMessage('Document ready!');

        // Fetch and display pricing
        const projectPricing = await fetchProjectPricing(project.data.id);
        setPricing(projectPricing);

        // Fetch associated professional services after project creation
        try {
          const services = await fetchProjectServices(project.data.id);
          setProjectServices(services);
          console.log('Fetched Services:', services);

          // Access the services array correctly
          const serviceDescriptions = services.data.map(service => ({
            recipe_name: service.attributes.name,
            ingredients: service.attributes['service-description'].split('. '),
          }));

          // Define the questionnaire answers (replace with actual data)
          const questionnaireAnswers = {
            clientOverview: "Brief description of the client's business and industry.",
            engagementObjectives: "Specific goals the client aims to achieve.",
            keyFindings: "Critical insights gathered from discovery.",
            proposedSolution: "Recommended services and methodologies.",
            businessImpact: "Expected business impact and success metrics.",
            nextSteps: "Implementation plan and key milestones."
          };

          // Create a detailed prompt for the AI model
          const prompt = `Generate an executive summary for a professional services engagement. The summary should be concise yet comprehensive, clearly outlining the business objectives, key challenges, proposed solutions, and expected outcomes. Use structured data from the discovery questionnaires to provide specific insights into the client's needs, operational constraints, and strategic goals.

The summary should include the following sections:

Client Overview – Briefly describe the client's business, industry, and relevant background.
Engagement Objectives – Define the specific goals the client aims to achieve through this engagement, linking them to measurable business outcomes.
Key Findings from Discovery – Highlight critical insights gathered from discovery, including pain points, inefficiencies, or opportunities for improvement. Use relevant quantitative and qualitative data.
Proposed Solution & Approach – Outline the recommended services, methodologies, and frameworks that will be applied to address the client's challenges.
Business Impact & Success Metrics – Explain the expected business impact, KPIs, and success measures that will determine the effectiveness of the engagement.
Next Steps & Timeline – Summarize the implementation plan, key milestones, and next steps to ensure alignment with the client's priorities.

Use a professional, results-oriented tone and ensure clarity in articulating the value proposition. Keep the focus on strategic outcomes rather than technical details, making it accessible to executive stakeholders.

Client Name: ${clientName}
Questionnaire Answers: ${JSON.stringify(questionnaireAnswers, null, 2)}
Recommended Services: ${JSON.stringify(serviceDescriptions, null, 2)}`;

          // Generate executive summary using AI
          const summary = await generateContentWithAI(prompt);
          console.log('Generated Summary:', summary);
          setExecutiveSummary(summary);
          setShowSummary(true);
        } catch (error) {
          console.error('Failed to fetch project services:', error);
        }

        // Reset form
        setProjectName('');
        setClientName('');
        setSelectedQuestionnaire('');
        setQuestions([]);
        setAnswers({});
        setMsaDate('');
        setSelectedClient(null);
        setProjectId(project.data.id);
      }
    } catch (error) {
      console.error('Error in form submission:', error);
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { accountId, accountName, userName } = await getCurrentUserAndAccount();
        setAccountId(accountId);
        setAccountName(accountName);
        setCurrentUser(userName);

        const questionnaireData = await fetchQuestionnaires();
        setQuestionnaires(questionnaireData);

        const defaultRateTableId = await fetchDefaultRateTable();
        setRateTableId(defaultRateTableId);

        const defaultPaymentTerm = await fetchDefaultPaymentTerm();
        console.log('Default payment term:', defaultPaymentTerm);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadQuestions = async () => {
      if (selectedQuestionnaire) {
        try {
          const questionData = await fetchQuestionnaireQuestions(selectedQuestionnaire);
          setQuestions(questionData.attributes.questions);
          setAnswers({});
        } catch (error) {
          console.error('Error loading questions:', error);
        }
      }
    };
    loadQuestions();
  }, [selectedQuestionnaire]);

  // Use useCallback to memoize loadProjectServices
  const loadProjectServices = useCallback(async (projectId) => {
    setIsLoading(true);
    try {
      const services = await fetchProjectServices(projectId);
      setProjectServices(services);
      console.log('Fetched Services:', services);

      // Access the services array correctly
      const serviceDescriptions = services.data.map(service => ({
        recipe_name: service.attributes.name,
        ingredients: service.attributes['service-description'].split('. '),
      }));

      // Create a prompt for the AI model
      const prompt = `Generate an executive summary for the client ${clientName} based on the following services:\n${JSON.stringify(serviceDescriptions)}`;

      // Generate executive summary using AI
      const summary = await generateContentWithAI(prompt);
      console.log('Generated Summary:', summary);
      setExecutiveSummary(summary);
      setShowSummary(true);
    } catch (error) {
      console.error('Failed to fetch project services:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientName]);

  useEffect(() => {
    if (projectId) {
      loadProjectServices(projectId);
    }
  }, [projectId, loadProjectServices]);

  return (
    <div className="form-container">
      <header className="form-header">
        <div className="status-bar">
          <span className="time">9:41</span>
          <div className="status-icons">
            <span className="signal">●●●●</span>
            <span className="wifi">●</span>
            <span className="battery">●</span>
          </div>
        </div>
        <img 
          src="/assets/SS-Logo-Horiztonal-allwhite.png"
          alt="ScopeStack" 
          className="header-logo"
        />
      </header>
      
      <form onSubmit={handleSubmit} className="form-content">
        <h1 className="form-heading">Create an Estimate</h1>
        <p className="form-subheading">Fill out the form below to create a new estimate</p>
        <div className="account-info">
          <p className="account-detail">Account: {accountName}</p>
          <p className="account-detail">User: {currentUser}</p>
        </div>

        <div className="form-section">
          <h2 className="section-header">Project Info</h2>
          
          <div className="input-group">
            <label>
              <span className="required">*</span>
              Project name
            </label>
            <input
              type="text"
              className="form-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Client name
            </label>
            <div className="client-search-container">
              <input
                type="text"
                className="form-input"
                value={clientName}
                onChange={handleClientInputChange}
                placeholder="Enter client name"
                required
              />
              
              {filteredClients.length > 0 && (
                <ul className="client-dropdown">
                  {filteredClients.map((client) => (
                    <li
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className="client-dropdown-item"
                    >
                      {client.attributes.name}
                    </li>
                  ))}
                </ul>
              )}
              
              {clientName && filteredClients.length === 0 && !selectedClient && (
                <div className="helper-text">
                  No existing clients found. A new client will be created.
                </div>
              )}
              
              {selectedClient && (
                <div className="helper-text success">
                  Selected existing client: {selectedClient.attributes.name}
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              MSA Date
            </label>
            <input 
              type="date" 
              className="form-input"
              value={msaDate} 
              onChange={(e) => setMsaDate(e.target.value)} 
              required 
            />
          </div>

          <input 
            type="hidden" 
            name="payment-term" 
            value={selectedPaymentTerm.id} 
          />

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Contact Name
            </label>
            <input
              type="text"
              className="form-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact name"
              required
            />
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Contact Email
            </label>
            <input
              type="email"
              className="form-input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Enter contact email"
              required
            />
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Contact Phone
            </label>
            <input
              type="tel"
              className="form-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Enter contact phone"
              required
            />
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Contact Title
            </label>
            <input
              type="text"
              className="form-input"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              placeholder="Enter contact title"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-header">Solution Input</h2>
          <div className="input-group">
            <select
              value={selectedQuestionnaire}
              onChange={(e) => setSelectedQuestionnaire(e.target.value)}
              className="form-input"
            >
              <option value="" disabled>Select Solution</option>
              {questionnaires.map((questionnaire) => (
                <option key={questionnaire.id} value={questionnaire.id}>
                  {questionnaire.attributes.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="form-section">
            <h2 className="section-header">Responses</h2>
            {questions.map((question) => (
              <div key={question.slug} className="input-group">
                <label>{question.question} {question.required && '*'}</label>
                {Array.isArray(question['select-options']) && question['select-options'].length > 0 ? (
                  <select
                    className="form-input"
                    value={answers[question.slug] || ''}
                    onChange={(e) => handleAnswerChange(question.slug, e.target.value, question.id)}
                    required={question.required}
                  >
                    <option value="">-- Select an option --</option>
                    {question['select-options'].map((option) => (
                      <option key={option.key} value={option.value}>
                        {option.key}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={question['value-type'] === 'number' ? 'number' : 'text'}
                    value={answers[question.slug] || ''}
                    onChange={(e) => handleAnswerChange(question.slug, e.target.value, question.id)}
                    required={question.required}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <button type="submit" className="form-button" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Create Project'}
        </button>

        {statusMessage && (
          <div className="status-container">
            <div className="status-message">
              {statusMessage}
            </div>
            {documentUrl && (
              <div className="document-link">
                <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                  Open Document
                </a>
              </div>
            )}
          </div>
        )}

        {pricing && (
          <div className="pricing-section">
            <h2>Financials</h2>
            <div className="pricing-row">
              <span className="pricing-label">Revenue</span>
              <span className="pricing-value revenue">
                {new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: 'USD'
                }).format(pricing.revenue)}
              </span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">Cost</span>
              <span className="pricing-value cost">
                {new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: 'USD'
                }).format(pricing.cost)}
              </span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">Margin</span>
              <span className="pricing-value profit">
                {new Intl.NumberFormat('en-US', { 
                  style: 'percent',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(pricing.margin / 100)}
              </span>
            </div>
          </div>
        )}

        {projectServices.length > 0 && (
          <div>
            <h3>Project Services</h3>
            <ul>
              {projectServices.map(service => (
                <li key={service.id}>{service.attributes.name}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {showSummary && (
        <ExecutiveSummary summary={executiveSummary} onClose={handleCloseSummary} />
      )}
    </div>
  );
};

export default NewProjectForm;

const styles = `
  .client-search-container {
    position: relative;
    margin-bottom: 20px;
  }

  .client-dropdown li:hover {
    background-color: #f5f5f5;
  }

  .client-dropdown li:last-child {
    border-bottom: none;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
