import axios from 'axios';

const API_TOKEN = process.env.REACT_APP_SCOPSTACK_API_TOKEN;
const ACCOUNT_SLUG = process.env.REACT_APP_SCOPSTACK_ACCOUNT_SLUG;

const apiScoped = axios.create({
  baseURL: `https://api.scopestack.io/${ACCOUNT_SLUG}`,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/vnd.api+json",
  },
});

// ✅ Get Current User & Account Info
export const getCurrentUserAndAccount = async () => {
  try {
    const response = await axios.get("https://api.scopestack.io/v1/me", {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/vnd.api+json",
      },
    });

    const { "account-id": accountId, "account-slug": accountName, name: userName } = response.data.data.attributes;
    return { accountId, accountName, userName };
  } catch (error) {
    console.error("❌ Error fetching user/account details:", error);
    throw error;
  }
};

// ✅ Fetch Questionnaires (with optional tag filtering)
export const fetchQuestionnaires = async (tag = null) => {
  try {
    let url = "/v1/questionnaires?filter[active]=true&filter[published]=true";
    if (tag) url += `&filter[tag-list]=${tag}`;

    const response = await apiScoped.get(url);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error fetching questionnaires:", error);
    throw error;
  }
};

// ✅ Fetch Questions for a Questionnaire
export const fetchQuestionnaireQuestions = async (questionnaireId) => {
  try {
    const response = await apiScoped.get(`/v1/questionnaires/${questionnaireId}?include=questions`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error fetching questionnaire questions:", error);
    throw error;
  }
};

// ✅ Fetch Clients (for typeahead search)
export const fetchClients = async (searchTerm) => {
  try {
    const response = await apiScoped.get(`/v1/clients?filter[name]=${searchTerm}`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error fetching clients:", error);
    throw error;
  }
};

// ✅ Fetch Default Rate Table
export const fetchDefaultRateTable = async () => {
  try {
    const response = await apiScoped.get("/v1/rate-tables?filter[active]=true");
    const defaultRateTable = response.data.data.find((rateTable) => rateTable.attributes.default === true);
    return defaultRateTable ? defaultRateTable.id : null;
  } catch (error) {
    console.error("❌ Error fetching default rate table:", error);
    throw error;
  }
};

// Fetch the default payment term
export const fetchDefaultPaymentTerm = async () => {
  try {
    const response = await apiScoped.get('/v1/payment-terms?filter[active]=true&include=account');
    const defaultTerm = response.data.data.find(term => term.attributes.default === true);
    return defaultTerm ? defaultTerm.id : null;
  } catch (error) {
    console.error('❌ Error fetching default payment term:', error);
    throw error;
  }
};


// ✅ Fetch Required Variables
export const fetchRequiredProjectVariables = async () => {
  try {
    const response = await apiScoped.get('/v1/project-variables?filter[active]=true&include=account');
    const requiredVariables = response.data.data.filter(
      (variable) => variable.attributes.required === true && variable.attributes["variable-context"] === "project"
    );
    return requiredVariables;
  } catch (error) {
    console.error('Error fetching required project variables:', error);
    throw error;
  }
};
//✅ Create a new project
export const createProject = async (projectData) => {
  try {
    const response = await apiScoped.post('/v1/projects', projectData, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error creating project:', error.response?.data || error.message);
    throw error;
  }
};


// ✅ Create a New Project Contact (Fixed Format)
export const createProjectContact = async (projectId, contactData) => {
  try {
    const response = await apiScoped.post("/v1/project-contacts", {
      data: {
        type: "project-contacts",
        attributes: {
          active: true,
          name: contactData.name,
          title: "Primary Contact",
          email: contactData.email,
          phone: contactData.phone,
          "contact-type": "primary_customer_contact",
        },
        relationships: {
          project: { data: { type: "projects", id: projectId } },
        },
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ Error creating project contact:", error.response?.data || error);
    throw error;
  }
};

// 1️⃣ Create Survey
export const createSurvey = async (projectId, questionnaireId, surveyData) => {
  const requestData = {
    data: {
      type: "surveys",
      attributes: {
        name: `${surveyData.name} Survey`,
        responses: surveyData.responses
      },
      relationships: {
        account: { data: { id: surveyData.accountId, type: "accounts" } },
        questionnaire: { data: { id: questionnaireId, type: "questionnaires" } },
        project: { data: { id: projectId, type: "projects" } }
      }
    }
  };

  try {
    const response = await apiScoped.post("/v1/surveys", requestData);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error creating survey:", error);
    throw error;
  }
};

// 2️⃣ Calculate Survey Recommendations
export const calculateSurveyRecommendations = async (surveyId) => {
  try {
    const response = await apiScoped.put(`/v1/surveys/${surveyId}/calculate`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error calculating survey recommendations:", error);
    throw error;
  }
};

// Helper function to check calculation status
export const checkCalculationStatus = async (surveyId) => {
  try {
    const response = await apiScoped.get(`/v1/surveys/${surveyId}`);
    return response.data.data.attributes.status;
  } catch (error) {
    console.error("❌ Error checking calculation status:", error);
    throw error;
  }
};

// 3️⃣ Fetch Survey Recommendations
export const fetchSurveyRecommendations = async (surveyId) => {
  try {
    const response = await apiScoped.get(`/v1/surveys/${surveyId}/recommendations`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error fetching survey recommendations:", error);
    throw error;
  }
};

// 4️⃣ Apply Survey Recommendations
export const applySurveyRecommendations = async (surveyId) => {
  try {
    const response = await apiScoped.put(`/v1/surveys/${surveyId}/apply`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error applying recommendations:", error);
    throw error;
  }
};

// Complete Survey Workflow
export const executeSurveyWorkflow = async (projectId, questionnaireId, surveyData) => {
  try {
    // Create Survey
    console.log('Creating survey...');
    const survey = await createSurvey(projectId, questionnaireId, surveyData);
    console.log('Survey created:', survey);

    // Calculate Recommendations
    console.log('Calculating recommendations...');
    await calculateSurveyRecommendations(survey.id);

    // Wait for calculation to complete
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      status = await checkCalculationStatus(survey.id);
      console.log('Calculation status:', status);
    } while (status === 'calculating');

    // Apply Recommendations
    console.log('Applying recommendations...');
    const result = await applySurveyRecommendations(survey.id);
    console.log('Recommendations applied:', result);

    return result;
  } catch (error) {
    console.error('Error in survey workflow:', error);
    throw error;
  }
};

// 1️⃣ Create Project Document
export const createProjectDocument = async (projectId) => {
  try {
    const response = await apiScoped.post("/v1/project-documents", {
      data: {
        type: "project-documents",
        attributes: {
          "template-id": 1822, // SOW template ID
          "document-type": "sow",
        },
        relationships: {
          project: { 
            data: { 
              type: "projects", 
              id: projectId.toString() 
            } 
          },
        },
      },
    });

    return response.data.data;
  } catch (error) {
    console.error("❌ Error creating project document:", error.response?.data || error);
    throw error;
  }
};

// 2️⃣ Get Project Documents
export const getProjectDocuments = async (projectId) => {
  try {
    const response = await apiScoped.get(`/v1/project-documents?filter[project]=${projectId}&include=project`);
    return response.data.data;
  } catch (error) {
    console.error("❌ Error fetching project documents:", error);
    throw error;
  }
};

// 3️⃣ Poll Document Status
export const pollDocumentStatus = async (projectId, documentId, onComplete) => {
  const maxRetries = 30; // 5 minutes maximum
  let retries = 0;

  const intervalId = setInterval(async () => {
    retries += 1;
    if (retries > maxRetries) {
      console.error('❌ Document generation timed out after 5 minutes');
      clearInterval(intervalId);
      return;
    }

    try {
      const projectDocs = await getProjectDocuments(projectId);
      const document = projectDocs.find(
        (doc) => doc.id === documentId && 
        doc.attributes['document-type'] === 'sow'
      );

      if (document) {
        console.log('📄 Document status:', document.attributes.status);
        
        if (document.attributes.status === 'finished' && 
            document.attributes['document-url']) {
          clearInterval(intervalId);
          console.log('✅ Document ready:', document.attributes['document-url']);
          if (onComplete) {
            onComplete(document.attributes['document-url']);
          } else {
            window.open(document.attributes['document-url'], '_blank');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error polling document status:', error);
    }
  }, 10000); // Poll every 10 seconds

  // Return the interval ID so it can be cleared if needed
  return intervalId;
};

// 4️⃣ Complete Document Workflow
export const executeDocumentWorkflow = async (projectId) => {
  try {
    // Generate document
    const document = await createProjectDocument(projectId);
    console.log('📄 Document generation started:', document);

    if (!document || !document.id) {
      throw new Error('Document creation failed - no document ID received');
    }

    // Start polling and return a promise that resolves when document is ready
    return new Promise((resolve, reject) => {
      pollDocumentStatus(projectId, document.id, (documentUrl) => {
        resolve({ documentId: document.id, documentUrl });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        reject(new Error('Document generation timed out'));
      }, 300000);
    });
  } catch (error) {
    console.error('❌ Error in document workflow:', error);
    throw error;
  }
};

export const searchClients = async (searchTerm) => {
  try {
    const response = await apiScoped.get(`/v1/clients`, {
      params: {
        'filter[name]': searchTerm,
        'filter[active]': true
      },
      headers: {
        'Accept': 'application/vnd.api+json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error searching clients:', error);
    return { data: [] };
  }
};

// ✅ Create a New Client
export const createClient = async (name, accountId) => {
  try {
    const response = await apiScoped.post('/v1/clients', {
      data: {
        type: 'clients',
        attributes: {
          name: name,
          active: true
        },
        relationships: {
          account: {
            data: {
              type: 'accounts',
              id: accountId
            }
          }
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error creating client:', error);
    throw error;
  }
};

// Fetch Project Pricing
export const fetchProjectPricing = async (projectId) => {
  try {
    const response = await apiScoped.get(`/v1/projects/${projectId}`);
    const project = response.data.data;
    return {
      revenue: project.attributes['contract-revenue'],
      cost: project.attributes['contract-cost'],
      margin: project.attributes['contract-margin']
    };
  } catch (error) {
    console.error("❌ Error fetching project pricing:", error);
    throw error;
  }
};

export default apiScoped;