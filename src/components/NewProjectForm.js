import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchClients,
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
  getProjectDocuments,
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
  const [selectedPaymentTerm, setSelectedPaymentTerm] = useState(null);

  const [accountId, setAccountId] = useState(null);
  const [accountSlug, setAccountSlug] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactTitle, setContactTitle] = useState('');

  const [filteredClients, setFilteredClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  // Add state for contact selection
  const [availableContacts, setAvailableContacts] = useState([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [isNewContact, setIsNewContact] = useState(false);

  // Add new state for loading and status messages
  const [statusMessage, setStatusMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [projectServices, setProjectServices] = useState([]);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const [projectId, setProjectId] = useState(null);

  const executiveSummaryGeneratedRef = useRef(false);

  const handleClientSearch = async (searchTerm) => {
    if (searchTerm.trim() === '') {
      setFilteredClients([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetchClients(searchTerm.toLowerCase());
      setFilteredClients(response || []);
    } catch (error) {
      console.error('Error searching clients:', error);
      setFilteredClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Directly handle input change without debounce
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
    setClientName(client.name);
    setSelectedClient(client);
    setFilteredClients([]);

    // Set the MSA date if it exists
    if (client.msaDate) {
      setMsaDate(client.msaDate);
    } else {
      setMsaDate(''); // Clear the MSA date if not available
    }
    
    // Check if client has multiple contacts
    if (client.contacts && client.contacts.length > 1) {
      // Multiple contacts - show selector
      console.log("Client has multiple contacts:", client.contacts);
      setAvailableContacts(client.contacts);
      setShowContactSelector(true);
      setIsNewContact(false);
      
      // Clear contact fields until a contact is selected
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactTitle('');
    } else if (client.contacts && client.contacts.length === 1) {
      // Single contact - auto-fill
      console.log("Client has one contact:", client.contacts[0]);
      const primaryContact = client.contacts[0];
      setContactName(primaryContact.name || '');
      setContactEmail(primaryContact.email || '');
      setContactPhone(primaryContact.phone || '');
      setContactTitle(primaryContact.title || '');
      setShowContactSelector(false);
      setAvailableContacts([]);
    } else {
      // No contacts - clear fields
      console.log("Client has no contacts");
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactTitle('');
      setShowContactSelector(false);
      setAvailableContacts([]);
      setIsNewContact(true);
    }
  };
  
  // Handle selecting a contact from the list
  const handleContactSelect = (contact) => {
    console.log("Contact selected:", contact);
    setContactName(contact.name || '');
    setContactEmail(contact.email || '');
    setContactPhone(contact.phone || '');
    setContactTitle(contact.title || '');
    // Hide the contact selector after selection
    setShowContactSelector(false);
    // We're not creating a new contact
    setIsNewContact(false);
  };
  
  // Toggle to create a new contact
  const handleNewContact = () => {
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactTitle('');
    setIsNewContact(true);
    // Hide the selector after switching to new contact mode
    setShowContactSelector(false);
  };

  // Show contact selector when clicking on the contact name field
  const handleContactFieldFocus = () => {
    // Only show the selector if we have a selected client with contacts
    if (selectedClient && selectedClient.contacts && selectedClient.contacts.length > 0) {
      setShowContactSelector(true);
    }
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

      // Ensure accountSlug is available
      if (!accountSlug) {
        throw new Error('Account slug is missing.');
      }

      // Handle client creation/selection
      let clientId;
      if (selectedClient) {
        clientId = selectedClient.id;
      } else if (clientName.trim()) {
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
                id: selectedPaymentTerm.id
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

      const project = await createProject(projectData);
      setProjectId(project.data.id);
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
        const documentResult = await executeDocumentWorkflow(project.data.id, accountSlug);

        if (documentResult && documentResult.documentUrl) {
          setDocumentUrl(documentResult.documentUrl);
          setStatusMessage('Document ready!');
        } else {
          throw new Error('Failed to generate document. Document URL is missing.');
        }

        // Fetch and display pricing
        try {
          const projectPricing = await fetchProjectPricing(project.data.id);
          if (projectPricing) {
            setPricing(projectPricing);
          } else {
            console.error('Pricing data is undefined or empty.');
          }
        } catch (error) {
          console.error('Error fetching project pricing:', error);
        }

        // Fetch associated professional services after project creation
        const services = await fetchProjectServices(project.data.id);
        setProjectServices(services);
        console.log('Fetched Services:', services);

        // Fetch project documents
        const documents = await getProjectDocuments(project.data.id);
        console.log('Fetched Documents:', documents);

        // Generate executive summary after services are fetched
        if (!executiveSummaryGeneratedRef.current) {
          const serviceDescriptions = services.data.map(service => ({
            recipe_name: service.attributes.name,
            ingredients: service.attributes['service-description']?.split('. ') || [],
          }));

          const prompt = `Generate an executive summary for the client ${clientName} based on the following services:\n${JSON.stringify(serviceDescriptions)}`;

          const summary = await generateContentWithAI(prompt);
          console.log('Generated Summary:', summary);
          setExecutiveSummary(summary);
          setShowSummary(true);

          executiveSummaryGeneratedRef.current = true; // Mark as generated
        }
      }
    } catch (error) {
      console.error('Error in form submission:', error);
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
        const { accountId, accountSlug, userName } = await getCurrentUserAndAccount();
        setAccountId(accountId);
        setAccountSlug(accountSlug);
        console.log('Account Slug:', accountSlug);
        setCurrentUser(userName);

        const questionnaireData = await fetchQuestionnaires();
        setQuestionnaires(questionnaireData);

        const defaultRateTableId = await fetchDefaultRateTable();
        setRateTableId(defaultRateTableId);

        const defaultTermId = await fetchDefaultPaymentTerm(accountId);
        console.log('Fetched Default Payment Term ID:', defaultTermId);
        if (defaultTermId) {
          setSelectedPaymentTerm({
            id: defaultTermId,
            type: "payment-terms",
            attributes: {
              active: true,
              // Add other necessary attributes here if needed
            },
          });
        }
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
          
          // Filter out questions that have a deleted-at date
          const activeQuestions = questionData.attributes.questions.filter(
            question => question['deleted-at'] === null
          );
          
          // Set only the active questions in state
          setQuestions(activeQuestions);
          setAnswers({});
        } catch (error) {
          console.error('Error loading questions:', error);
        }
      }
    };
    loadQuestions();
  }, [selectedQuestionnaire]);

  // Modify loadProjectServices to prevent duplicate AI content generation
  const loadProjectServices = useCallback(async (projectId) => {
    if (!projectId) return; // Prevent duplicate calls

    setIsLoading(true);
    try {
      const services = await fetchProjectServices(projectId);
      setProjectServices(services);
      console.log('Fetched Services:', services);
    } catch (error) {
      console.error('Failed to fetch project services:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      loadProjectServices(projectId);
    }
  }, [projectId, loadProjectServices]);

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit} className="form-content">
        <h1 className="form-heading">Create an Estimate</h1>
        <p className="form-subheading">Fill out the form below to create a new estimate</p>
        <div className="account-info">
          <p className="account-detail">Account: {accountSlug}</p>
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
              {isLoading && <div>Loading...</div>}
              {filteredClients.length > 0 && (
                <ul className="client-dropdown">
                  {filteredClients.map((client) => (
                    <li
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className="client-dropdown-item"
                    >
                      {client.name || 'No Name'}
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
                  Selected existing client: {selectedClient.name}
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

          {selectedPaymentTerm && (
            <input 
              type="hidden" 
              name="payment-term" 
              value={selectedPaymentTerm.id} 
            />
          )}

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Customer Contact Name
            </label>
            {showContactSelector && (
              <div className="contact-selector">
                <h4>Contacts for {selectedClient && selectedClient.name}</h4>
                {isNewContact ? (
                  <div className="new-contact-message">Creating a new contact</div>
                ) : (
                  <ul className="contact-list">
                    {availableContacts.map((contact) => (
                      <li 
                        key={contact.id} 
                        onClick={() => handleContactSelect(contact)}
                        className={`contact-item ${contactName === contact.name ? 'contact-selected' : ''}`}
                      >
                        <strong>{contact.name}</strong> {contact.title && `- ${contact.title}`} {contact.email && `- ${contact.email}`}
                        {contactName === contact.name && <span className="selected-indicator"> (Selected)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <button 
                  type="button" 
                  className={`new-contact-btn ${isNewContact ? 'active' : ''}`}
                  onClick={handleNewContact}
                >
                  {isNewContact ? 'Currently creating new contact' : 'Create new contact'}
                </button>
                {isNewContact && availableContacts.length > 0 && (
                  <button 
                    type="button" 
                    className="text-button"
                    onClick={() => setIsNewContact(false)}
                  >
                    ← Back to existing contacts
                  </button>
                )}
              </div>
            )}
            <div className="input-with-indicator">
              <input
                type="text"
                className="form-input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onClick={handleContactFieldFocus}
                onFocus={handleContactFieldFocus}
                placeholder="Enter contact name"
                required
              />
              {selectedClient && selectedClient.contacts && selectedClient.contacts.length > 0 && !showContactSelector && (
                <div className="contact-field-hint">
                  {selectedClient.contacts.length} {selectedClient.contacts.length === 1 ? 'Contact' : 'Contacts'}
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label>
              <span className="required">*</span>
              Customer Contact Email
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
              Customer Contact Phone
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
              Customer Contact Title
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
                }).format(pricing.margin)}
              </span>
            </div>
          </div>
        )}

        {showSummary && (
          <ExecutiveSummary summary={executiveSummary} onClose={handleCloseSummary} />
        )}
        {Array.isArray(projectServices) && projectServices.length > 0 && (
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
  
  .contact-selector {
    margin-bottom: 15px;
    padding: 10px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  
  .contact-selector h4 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 14px;
    color: #333;
  }
  
  .contact-list {
    list-style: none;
    padding: 0;
    margin: 0 0 15px 0;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .contact-item {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .contact-item:hover {
    background-color: #f0f0f0;
  }
  
  .contact-selected {
    background-color: #e6f7ff;
    border-left: 3px solid #1890ff;
  }
  
  .selected-indicator {
    color: #1890ff;
    font-size: 12px;
    font-style: italic;
  }
  
  .new-contact-message {
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f0f7ff;
    border-radius: 4px;
    color: #1890ff;
    font-weight: 500;
    text-align: center;
    border-left: 3px solid #1890ff;
  }
  
  .input-with-indicator {
    position: relative;
  }
  
  .contact-field-hint {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: #1890ff;
    background-color: #f0f7ff;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid #91d5ff;
    cursor: pointer;
    white-space: nowrap;
    font-weight: 500;
    line-height: 1;
    min-width: auto;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  
  .new-contact-btn {
    display: block;
    width: 100%;
    padding: 8px;
    background-color: #e6f7ff;
    border: 1px solid #91d5ff;
    border-radius: 4px;
    color: #1890ff;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .new-contact-btn:hover {
    background-color: #bae7ff;
  }
  
  .new-contact-btn.active {
    background-color: #1890ff;
    color: white;
    font-weight: 500;
  }
  
  .back-link {
    margin-bottom: 10px;
  }
  
  .text-button {
    background: none;
    border: none;
    color: #1890ff;
    cursor: pointer;
    padding: 0;
    margin-top: 8px;
    font-size: 14px;
    text-decoration: underline;
    display: block;
    width: 100%;
    text-align: center;
  }
  
  .text-button:hover {
    color: #40a9ff;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
