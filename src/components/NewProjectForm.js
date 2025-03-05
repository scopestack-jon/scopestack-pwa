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
  fetchSalesExecutives,
} from '../services/api';
import './NewProjectForm.css';
import ExecutiveSummary from './ExecutiveSummary';

// Define the default prompt template for executive summary generation
const DEFAULT_PROMPT_TEMPLATE = `
Generate a professional executive summary for {{clientName}} based on the following context:

CLIENT INFORMATION:
Client Name: {{clientName}}
Project Name: {{projectName}}

SURVEY RESPONSES:
{{surveyContext}}

RECOMMENDED SERVICES:
{{serviceDescriptions}}

The executive summary should:
1. Begin with an introduction that mentions the client by name and the project context
2. Summarize the client's needs based on the survey responses
3. Outline the recommended services and their specific benefits to address those needs
4. Highlight key technical aspects of the solution
5. Conclude with the anticipated business outcomes and ROI
6. Keep the tone professional but conversational
7. Target length: 3-4 paragraphs
`;

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

  // New prompt template state
  const [promptTemplate, setPromptTemplate] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');

  const executiveSummaryGeneratedRef = useRef(false);

  // Add state for sales executive
  const [salesExecutiveName, setSalesExecutiveName] = useState('');
  const [filteredExecutives, setFilteredExecutives] = useState([]);
  const [selectedExecutive, setSelectedExecutive] = useState(null);
  const [isExecutiveLoading, setIsExecutiveLoading] = useState(false);

  // Load the saved prompt template from localStorage or use default
  useEffect(() => {
    const savedPrompt = localStorage.getItem('executiveSummaryPromptTemplate');
    setPromptTemplate(savedPrompt || DEFAULT_PROMPT_TEMPLATE);
    setEditedPrompt(savedPrompt || DEFAULT_PROMPT_TEMPLATE);
  }, []);

  // Save the prompt template to localStorage
  const savePromptTemplate = (shouldRegenerate = false) => {
    localStorage.setItem('executiveSummaryPromptTemplate', editedPrompt);
    setPromptTemplate(editedPrompt);
    setShowPromptEditor(false);
    
    // Regenerate the summary if requested
    if (shouldRegenerate) {
      regenerateExecutiveSummary();
    }
  };

  // Reset prompt to default template
  const resetPromptTemplate = () => {
    setEditedPrompt(DEFAULT_PROMPT_TEMPLATE);
  };

  // Apply the template by replacing placeholders with actual values
  const applyPromptTemplate = (template, data) => {
    let result = template;
    
    // Replace client and project name placeholders
    result = result.replace(/{{clientName}}/g, data.clientName);
    result = result.replace(/{{projectName}}/g, data.projectName);
    
    // Replace survey context placeholder
    result = result.replace(/{{surveyContext}}/g, data.surveyContext);
    
    // Replace service descriptions placeholder
    result = result.replace(/{{serviceDescriptions}}/g, data.serviceDescriptions);
    
    return result;
  };

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

  // Add handler for sales executive search
  const handleExecutiveSearch = async (searchTerm) => {
    if (searchTerm.trim() === '') {
      setFilteredExecutives([]);
      return;
    }

    setIsExecutiveLoading(true);
    try {
      const response = await fetchSalesExecutives(searchTerm.toLowerCase());
      setFilteredExecutives(response || []);
    } catch (error) {
      console.error('Error searching sales executives:', error);
      setFilteredExecutives([]);
    } finally {
      setIsExecutiveLoading(false);
    }
  };

  // Add handler for sales executive input change
  const handleExecutiveInputChange = (e) => {
    const searchTerm = e.target.value;
    setSalesExecutiveName(searchTerm);
    if (searchTerm.length >= 2) {
      handleExecutiveSearch(searchTerm);
    } else {
      setFilteredExecutives([]);
    }
  };

  // Add handler for sales executive selection
  const handleExecutiveSelect = (executive) => {
    setSalesExecutiveName(executive.name);
    setSelectedExecutive(executive);
    setFilteredExecutives([]);
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
      if (!selectedExecutive) {
        throw new Error('Sales Executive is required.');
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
            },
            'sales-executive': {
              data: {
                type: 'sales-executives',
                id: selectedExecutive.id.toString()
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
        try {
          const services = await fetchProjectServices(project.data.id);
          if (services && services.data) {
            setProjectServices(services);
            console.log('Fetched Services:', services);
            
            // Generate executive summary after services are successfully fetched
            if (!executiveSummaryGeneratedRef.current) {
              try {
                // Format survey questions and responses for the prompt
                const surveyContext = Object.entries(answers).map(([questionSlug, answer]) => {
                  const question = questions.find(q => q.slug === questionSlug);
                  return `QUESTION: ${question.question}\nANSWER: ${answer}`;
                }).join('\n\n');
                
                // Map services to a format useful for the AI prompt
                const serviceDescriptions = services.data.map(service => ({
                  service_name: service.attributes.name,
                  quantity: service.attributes.quantity || 1,
                  hours: service.attributes['total-hours'] || 'Not specified',
                  description: service.attributes['service-description'] || 'No description available',
                  position: service.attributes.position || 0
                }));
                
                // Sort services by position to maintain logical ordering
                serviceDescriptions.sort((a, b) => a.position - b.position);
                
                if (serviceDescriptions.length > 0) {
                  // Format service descriptions for the prompt
                  const formattedServices = serviceDescriptions.map(svc => 
                    `SERVICE: ${svc.service_name}
   QUANTITY: ${svc.quantity}
   HOURS: ${svc.hours}
   DESCRIPTION: ${svc.description}
  `).join('\n\n');
                  
                  // Create the prompt from the template
                  const prompt = applyPromptTemplate(promptTemplate, {
                    clientName,
                    projectName,
                    surveyContext,
                    serviceDescriptions: formattedServices
                  });
                  
                  const summary = await generateContentWithAI(prompt);
                  console.log('Generated Summary:', summary);
                  setExecutiveSummary(summary);
                  setShowSummary(true);
                  executiveSummaryGeneratedRef.current = true; // Mark as generated
                } else {
                  console.log('No service descriptions available for AI summary generation');
                  setExecutiveSummary('No services available to generate summary.');
                }
              } catch (error) {
                console.error('Error generating executive summary:', error);
              }
            }
          } else {
            console.log('No services data returned or function not implemented');
            setProjectServices([]);
          }
        } catch (error) {
          console.error('Error fetching project services:', error);
          setProjectServices([]);
        }

        // Fetch project documents
        const documents = await getProjectDocuments(project.data.id);
        console.log('Fetched Documents:', documents);
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

  // Add a function to regenerate the executive summary
  const regenerateExecutiveSummary = async () => {
    if (!projectId || !projectServices || !projectServices.data) {
      console.error('Cannot regenerate summary: missing project data');
      return;
    }

    setIsLoading(true);
    try {
      // Format survey questions and responses for the prompt
      const surveyContext = Object.entries(answers).map(([questionSlug, answer]) => {
        const question = questions.find(q => q.slug === questionSlug);
        return `QUESTION: ${question.question}\nANSWER: ${answer}`;
      }).join('\n\n');
      
      // Map services to a format useful for the AI prompt
      const serviceDescriptions = projectServices.data.map(service => ({
        service_name: service.attributes.name,
        quantity: service.attributes.quantity || 1,
        hours: service.attributes['total-hours'] || 'Not specified',
        description: service.attributes['service-description'] || 'No description available',
        position: service.attributes.position || 0
      }));
      
      // Sort services by position to maintain logical ordering
      serviceDescriptions.sort((a, b) => a.position - b.position);
      
      if (serviceDescriptions.length > 0) {
        // Format service descriptions for the prompt
        const formattedServices = serviceDescriptions.map(svc => 
          `SERVICE: ${svc.service_name}
 QUANTITY: ${svc.quantity}
 HOURS: ${svc.hours}
 DESCRIPTION: ${svc.description}
`).join('\n\n');
        
        // Create the prompt from the template
        const prompt = applyPromptTemplate(promptTemplate, {
          clientName,
          projectName,
          surveyContext,
          serviceDescriptions: formattedServices
        });
        
        const summary = await generateContentWithAI(prompt);
        console.log('Regenerated Summary:', summary);
        setExecutiveSummary(summary);
        setShowSummary(true);
      } else {
        console.log('No service descriptions available for AI summary generation');
        setExecutiveSummary('No services available to generate summary.');
      }
    } catch (error) {
      console.error('Error regenerating executive summary:', error);
    } finally {
      setIsLoading(false);
    }
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
      if (services && services.data) {
        setProjectServices(services);
        console.log('Fetched Services:', services);
      } else {
        console.log('No services data returned or API not implemented');
        setProjectServices([]);
      }
    } catch (error) {
      console.error('Failed to fetch project services:', error);
      setProjectServices([]);
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
          <div className="settings-gear-container">
            <button 
              type="button" 
              className="settings-gear-button" 
              onClick={() => setShowPromptEditor(true)}
              title="Customize AI Prompt"
            >
              ⚙️
            </button>
          </div>
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

          {/* Add Sales Executive dropdown */}
          <div className="input-group">
            <label>
              <span className="required">*</span>
              Sales Executive
            </label>
            <div className="client-search-container">
              <input
                type="text"
                className="form-input"
                value={salesExecutiveName}
                onChange={handleExecutiveInputChange}
                placeholder="Enter sales executive name"
                required
              />
              {isExecutiveLoading && <div>Loading...</div>}
              {filteredExecutives.length > 0 && (
                <ul className="client-dropdown">
                  {filteredExecutives.map((executive) => (
                    <li
                      key={executive.id}
                      onClick={() => handleExecutiveSelect(executive)}
                      className="client-dropdown-item"
                    >
                      {executive.name || 'No Name'}
                    </li>
                  ))}
                </ul>
              )}
              {salesExecutiveName && filteredExecutives.length === 0 && !selectedExecutive && !isExecutiveLoading && (
                <div className="helper-text">
                  No matching sales executives found.
                </div>
              )}
              {selectedExecutive && (
                <div className="helper-text success">
                  Selected sales executive: {selectedExecutive.name}
                </div>
              )}
            </div>
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
              {selectedClient && selectedClient.contacts && selectedClient.contacts.length > 0 && !showContactSelector && (
                <span className="contact-count-label">
                  ({selectedClient.contacts.length} {selectedClient.contacts.length === 1 ? 'Contact' : 'Contacts'} Available)
                </span>
              )}
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
          <ExecutiveSummary 
            summary={executiveSummary} 
            onClose={handleCloseSummary} 
            onRegenerate={regenerateExecutiveSummary}
            onEditPrompt={() => setShowPromptEditor(true)}
            isLoading={isLoading}
          />
        )}
        
        {projectServices && projectServices.data && Array.isArray(projectServices.data) && projectServices.data.length > 0 && (
          <div className="form-section pricing-section">
            <h2>Project Services</h2>
            <ul className="services-list">
              {projectServices.data.map(service => (
                <li key={service.id} className="service-item">
                  <span className="service-bullet">•</span>
                  {service.attributes?.name || 'Unnamed Service'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prompt Editor Modal */}
        {showPromptEditor && (
          <div className="modal-overlay">
            <div className="prompt-editor-modal">
              <h2>Edit Executive Summary Prompt</h2>
              <p className="prompt-instructions">
                Customize the AI prompt template. Use these placeholders:
                <ul>
                  <li><code>{"{{clientName}}"}</code> - Client's name</li>
                  <li><code>{"{{projectName}}"}</code> - Project name</li>
                  <li><code>{"{{surveyContext}}"}</code> - Survey questions and responses</li>
                  <li><code>{"{{serviceDescriptions}}"}</code> - Description of services</li>
                </ul>
              </p>
              
              <textarea 
                className="prompt-textarea" 
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={15}
              />
              
              <div className="prompt-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowPromptEditor(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="reset-button"
                  onClick={resetPromptTemplate}
                >
                  Reset to Default
                </button>
                <button 
                  type="button" 
                  className="save-button"
                  onClick={() => savePromptTemplate(false)}
                >
                  Save Template
                </button>
                <button 
                  type="button" 
                  className="save-regenerate-button"
                  onClick={() => savePromptTemplate(true)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Save & Regenerate'}
                </button>
              </div>
            </div>
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
    margin-bottom: 10px;
  }

  .client-dropdown {
    position: absolute;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background-color: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
    margin-top: 2px;
    padding: 0;
    list-style: none;
  }

  .client-dropdown-item {
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    border-bottom: 1px solid #f0f0f0;
  }

  .client-dropdown li:hover {
    background-color: #f5f5f5;
  }

  .client-dropdown li:last-child {
    border-bottom: none;
  }
  
  .helper-text {
    margin-top: 2px;
    font-size: 12px;
    color: #ff4d4f;
  }
  
  .helper-text.success {
    color: #52c41a;
  }
  
  .contact-selector {
    margin-bottom: 10px;
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  
  .contact-selector h4 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 14px;
    color: #333;
  }
  
  .contact-list {
    list-style: none;
    padding: 0;
    margin: 0 0 10px 0;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .contact-item {
    padding: 6px 10px;
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
    padding: 8px;
    margin-bottom: 10px;
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
    right: 25px;
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
    z-index: 5;
  }
  
  /* Add this for better visibility of the badge */
  .contact-field-hint::before {
    content: '';
    position: absolute;
    top: -2px;
    right: -2px;
    bottom: -2px;
    left: -2px;
    background-color: white;
    border-radius: 12px;
    z-index: -1;
  }
  
  /* Ensure the text input has enough padding */
  input.form-input.with-hint {
    text-overflow: ellipsis;
    padding-right: 110px !important;
  }
  
  .new-contact-btn {
    display: block;
    width: 100%;
    padding: 6px;
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
    margin-bottom: 8px;
  }
  
  .text-button {
    background: none;
    border: none;
    color: #1890ff;
    cursor: pointer;
    padding: 0;
    margin-top: 6px;
    font-size: 14px;
    text-decoration: underline;
    display: block;
    width: 100%;
    text-align: center;
  }
  
  .text-button:hover {
    color: #40a9ff;
  }
  
  /* Project Services Styles */
  .services-list {
    list-style: none;
    padding: 0;
    margin: 10px 0 0 0;
  }
  
  .service-item {
    padding: 6px 0;
    font-size: 16px;
    color: #333;
    display: flex;
    align-items: center;
  }
  
  .service-bullet {
    color: #333;
    font-size: 18px;
    margin-right: 12px;
    line-height: 1;
  }
  
  /* Form layout spacing adjustments */
  .form-section {
    margin-bottom: 15px !important;
    padding: 15px !important;
  }
  
  .section-header {
    margin-top: 0 !important;
    margin-bottom: 12px !important;
  }
  
  .input-group {
    margin-bottom: 10px !important;
  }
  
  .input-group label {
    margin-bottom: 3px !important;
    display: block;
  }
  
  .form-input {
    padding: 8px 12px !important;
    min-height: 36px !important;
  }
  
  /* Reduce the height of select elements to match inputs */
  select.form-input {
    height: 36px !important;
  }
  
  /* Prompt Editor Styles */
  .prompt-editor-container {
    margin: 15px 0;
    padding: 12px;
    background-color: #f8f8f8;
    border-radius: 4px;
    border-left: 3px solid #1890ff;
  }
  
  .prompt-actions-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .prompt-editor-button {
    background-color: #1890ff;
    color: white;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }
  
  .prompt-editor-button:hover {
    background-color: #096dd9;
  }
  
  .regenerate-button {
    background-color: #52c41a;
    color: white;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }
  
  .regenerate-button:hover {
    background-color: #389e0d;
  }
  
  .regenerate-button:disabled {
    background-color: #d9d9d9;
    cursor: not-allowed;
  }
  
  .prompt-helper-text {
    margin-top: 6px;
    font-size: 14px;
    color: #666;
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .prompt-editor-modal {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .prompt-editor-modal h2 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #333;
    font-size: 20px;
  }
  
  .prompt-instructions {
    margin-bottom: 12px;
    color: #666;
    font-size: 14px;
  }
  
  .prompt-instructions ul {
    margin-top: 6px;
    padding-left: 20px;
  }
  
  .prompt-instructions code {
    background-color: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 13px;
  }
  
  .prompt-textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
  }
  
  .prompt-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 15px;
    gap: 10px;
  }
  
  .cancel-button, .reset-button, .save-button {
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }
  
  .cancel-button {
    background-color: #f0f0f0;
    border: 1px solid #d9d9d9;
    color: #333;
  }
  
  .cancel-button:hover {
    background-color: #e0e0e0;
  }
  
  .reset-button {
    background-color: #fff2e8;
    border: 1px solid #ffbb96;
    color: #fa541c;
  }
  
  .reset-button:hover {
    background-color: #ffd8bf;
  }
  
  .save-button {
    background-color: #52c41a;
    border: 1px solid #52c41a;
    color: white;
  }
  
  .save-button:hover {
    background-color: #389e0d;
  }
  
  .save-regenerate-button {
    background-color: #1890ff;
    border: 1px solid #1890ff;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }
  
  .save-regenerate-button:hover {
    background-color: #096dd9;
  }
  
  .save-regenerate-button:disabled {
    background-color: #d9d9d9;
    border-color: #d9d9d9;
    color: rgba(0, 0, 0, 0.25);
    cursor: not-allowed;
  }
  
  /* Settings Gear Styles */
  .settings-gear-container {
    margin-left: auto;
    z-index: 100;
  }
  
  .settings-gear-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.3s;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .settings-gear-button:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.05);
    transform: rotate(45deg);
  }
  
  .contact-count-label {
    margin-left: 6px;
    font-size: 13px;
    color: #1890ff;
    font-weight: normal;
    background-color: #f0f7ff;
    padding: 1px 6px;
    border-radius: 12px;
    border: 1px solid #91d5ff;
    display: inline-block;
    line-height: 1.2;
  }

  /* Additional spacing reduction for the overall form */
  .form-container {
    padding: 15px !important;
  }
  
  .form-content {
    padding: 15px !important;
  }
  
  .form-heading {
    margin-bottom: 5px !important;
  }
  
  .form-subheading {
    margin-bottom: 10px !important;
  }
  
  .account-info {
    margin-bottom: 10px !important;
    padding: 8px !important;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
