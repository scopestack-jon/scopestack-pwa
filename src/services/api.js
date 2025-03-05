import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_TOKEN = process.env.REACT_APP_SCOPSTACK_API_TOKEN;
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const REFRESH_TOKEN_URL = 'https://app.scopestack.io/oauth/token'; // Updated refresh URL

let accessToken = API_TOKEN; // Initial access token
let refreshToken = localStorage.getItem('refreshToken'); // Retrieve refresh token from storage

// Function to create a new axios instance with dynamic base URL
const createApiScopedInstance = (accountSlug) => {
  return axios.create({
    baseURL: `https://api.scopestack.io/${accountSlug}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
    },
  });
};

// Initialize apiScoped with a default account slug
let apiScoped = createApiScopedInstance(process.env.REACT_APP_SCOPSTACK_ACCOUNT_SLUG);

// Function to refresh the access token
const refreshAccessToken = async () => {
  try {
    const response = await axios.post(REFRESH_TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    localStorage.setItem('refreshToken', refreshToken);

    // Update the Authorization header for apiScoped
    apiScoped.defaults.headers.Authorization = `Bearer ${accessToken}`;

    return accessToken;
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    throw error;
  }
};

// Axios request interceptor
apiScoped.interceptors.request.use(
  async (config) => {
    if (isTokenExpired(accessToken)) {
      accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Function to check if the token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  const decoded = jwtDecode(token);
  return decoded.exp * 1000 < Date.now();
};

// Function to update apiScoped with the correct account slug
export const updateApiScopedInstance = (accountSlug) => {
  apiScoped = createApiScopedInstance(accountSlug);
};

// Use this function after fetching the accountSlug
export const getCurrentUserAndAccount = async () => {
  try {
    const response = await axios.get("https://api.scopestack.io/v1/me", {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/vnd.api+json",
      },
    });

    const { "account-id": accountId, "account-slug": accountSlug, name: userName } = response.data.data.attributes;
    updateApiScopedInstance(accountSlug); // Update apiScoped with the correct account slug
    return { accountId, accountSlug, userName };
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
    const response = await apiScoped.get(`/v1/clients?filter[active]=true&include=contacts&filter[name]=${searchTerm}`);
    return response.data.data.map(client => ({
      id: client.id,
      name: client.attributes.name, // Access name from attributes
      msaDate: client.attributes['msa-date'],
      contacts: client.relationships.contacts.data.map(contactRef => ({
        id: contactRef.id,
        name: contactRef.attributes.name,
        email: contactRef.attributes.email,
        phone: contactRef.attributes.phone,
      })),
    }));
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
export const fetchDefaultPaymentTerm = async (accountSlug) => {
  try {
    // Fetch all payment terms for the given account slug
    const response = await apiScoped.get(`/v1/payment-terms?filter[active]=true&include=account`);

    // Find the default payment term
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
export const fetchDocumentTemplates = async (accountSlug) => {
  try {
    const response = await apiScoped.get(`/v1/document-templates?filter[active]=true`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error fetching document templates:', error);
    throw error;
  }
};

export const executeDocumentWorkflow = async (projectId, accountSlug) => {
  try {
    // Step 1: Fetch document templates
    const templates = await fetchDocumentTemplates(accountSlug);
    if (!templates || templates.length === 0) {
      throw new Error('No document templates available.');
    }

    // Use the first template ID
    const templateId = templates[0].id;
    const templateName = templates[0].attributes.name;
    console.log(`Using template: ${templateName} (ID: ${templateId})`);

    // Step 2: Create the document
    const documentCreationResponse = await apiScoped.post("/v1/project-documents", {
      data: {
        type: "project-documents",
        attributes: {
          "template-id": templateId,
          "document-type": "sow",
          "force-regeneration": true,
          "generate-pdf": true,
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
    console.log('Document creation initiated:', documentCreationResponse.data);

    // Step 3: Poll for the document status and URL
    const maxAttempts = 10; // Maximum number of polling attempts
    const delay = 1000; // Delay between attempts in milliseconds

    const pollForDocument = async (attempt = 1) => {
      console.log(`Polling attempt ${attempt} for project ID: ${projectId}`);
      try {
        const documents = await getProjectDocuments(projectId);
        console.log(`Documents fetched:`, documents);

        if (documents && documents.length > 0) {
          const document = documents[0];
          const documentUrl = document.attributes['document-url'];
          const status = document.attributes.status;

          console.log(`Document status: ${status}, Document URL: ${documentUrl}`);

          if (status === 'finished' || documentUrl) {
            console.log(`Document URL found: ${documentUrl}`);
            return { documentUrl };
          }
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return pollForDocument(attempt + 1);
        } else {
          throw new Error('Document generation did not complete after multiple attempts.');
        }
      } catch (error) {
        console.error('Error in document workflow:', error);
        throw error;
      }
    };

    return pollForDocument();
  } catch (error) {
    console.error('Error in document workflow:', error);
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


export const createClient = async (clientName, accountId) => {
  try {
    const response = await apiScoped.post('/v1/clients', {
      data: {
        type: 'clients',
        attributes: {
          name: clientName,
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
    console.error("❌ Error creating client:", error);
    throw error;
  }
};



export const fetchProjectPricing = async (projectId) => {
  try {
    const response = await apiScoped.get(`/v1/projects/${projectId}`);
    const projectData = response.data.data.attributes;

    // Extract the required pricing attributes
    const pricing = {
      revenue: projectData['contract-revenue'],
      cost: projectData['contract-cost'],
      margin: projectData['contract-margin'],
    };

    return pricing;
  } catch (error) {
    console.error("❌ Error fetching project pricing:", error);
    throw error;
  }
};

export const fetchProjectServices = async (projectId) => {
  // Implement the function logic
};

export const generateContentWithAI = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: prompt }],
      }],
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const summary = response.data.candidates[0].content.parts[0].text;
    return summary;
  } catch (error) {
    console.error('Error generating content with AI:', error);
    throw error;
  }
};