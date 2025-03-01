import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class IkasService {
  private readonly ikasApiUrl = 'https://api.myikas.com/api/v1/admin/graphql';
  private readonly ikasXapiKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtIjoiZjkyOTFmNDctZDY1Ny00NTY5LTlhNGUtZTJmNjRhYmVkMjA3Iiwic2YiOiI1YmRmYmYzYi1lOWVmLTQ3ZjMtYmYzYi03MjlhNjcwYjMyZTgiLCJzZnQiOjEsInNsIjoiZWE3NTUyOWItNDU3MC00MTk5LWFlZjEtMzE5YTNiN2FhNGU3In0.NfVRBrkyqXQuDmrGdlFTf9X3oYBECDaBEpkV72d7eXc';
  private ikasAccessToken: string | null = null;
  private tokenExpiryTime: number | null = null;

  constructor(private configService: ConfigService) {}

  async getAccessToken() {
    try {
      const currentTime = Date.now();
      if (
        this.ikasAccessToken &&
        this.tokenExpiryTime &&
        currentTime < this.tokenExpiryTime
      ) {
        return this.ikasAccessToken;
      }

      const storeName = 'hikiestore';
      const clientId = this.configService.get('IKAS_CLIENT_ID');
      const clientSecret = this.configService.get('IKAS_CLIENT_SECRET');

      const response = await axios.post(
        `https://${storeName}.myikas.com/api/admin/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.ikasAccessToken = response.data.access_token;
      this.tokenExpiryTime = currentTime + 60 * 60 * 1000; // 1 saat

      console.log('getAccessToken', this.ikasAccessToken);

      return this.ikasAccessToken;
    } catch (error) {
      console.error('İkas token alma hatası:', error);
      throw error;
    }
  }

  async makeRequest(query: string, variables: any = {}) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        this.ikasApiUrl,
        {
          query,
          variables,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response;
    } catch (error) {
      console.error('IKAS API request error:', error.response?.data || error);
      throw error;
    }
  }

  async createIkasUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    isAcceptMarketing: boolean;
    captchaToken: string | null;
    phone: string;
  }) {
    const mutation = `
            mutation registerCustomer(
                $attributes: [CustomerAttributeValueInput!], 
                $captchaToken: String, 
                $email: String!, 
                $firstName: String!, 
                $isAcceptMarketing: Boolean, 
                $lastName: String!, 
                $locale: String, 
                $orderId: String, 
                $password: String!, 
                $phone: String, 
                $preferredLanguage: String
            ) {
                registerCustomer(
                    attributes: $attributes,
                    captchaToken: $captchaToken,
                    email: $email,
                    firstName: $firstName,
                    isAcceptMarketing: $isAcceptMarketing,
                    lastName: $lastName,
                    locale: $locale,
                    orderId: $orderId,
                    password: $password,
                    phone: $phone,
                    preferredLanguage: $preferredLanguage,
                ) {
                    customer {
                        id
                        email
                        firstName
                        lastName
                        phone
                        isEmailVerified
                        isPhoneVerified
                    }
                    token
                    tokenExpiry
                }
            }
        `;

    try {
      const response = await axios.post(
        'https://api.myikas.com/api/sf/graphql?op=registerCustomer',
        {
          query: mutation,
          variables: {
            ...userData,
            attributes: [],
            locale: null,
            orderId: null,
            preferredLanguage: null,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-api-key':
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtIjoiZjkyOTFmNDctZDY1Ny00NTY5LTlhNGUtZTJmNjRhYmVkMjA3Iiwic2YiOiI1YmRmYmYzYi1lOWVmLTQ3ZjMtYmYzYi03MjlhNjcwYjMyZTgiLCJzZnQiOjEsInNsIjoiZWE3NTUyOWItNDU3MC00MTk5LWFlZjEtMzE5YTNiN2FhNGU3In0.NfVRBrkyqXQuDmrGdlFTf9X3oYBECDaBEpkV72d7eXc',
          },
        },
      );

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      console.log(response.data);

      return response.data.data.registerCustomer;
    } catch (error) {
      console.error('IKAS user creation error:', error);
      throw error;
    }
  }

  async customerLogin(email: string, password: string) {
    const query = `
            mutation customerLogin (
                $captchaToken: String,
                $email: String!,
                $password: String!,
            ) {
                customerLogin (
                    captchaToken: $captchaToken,
                    email: $email,
                    password: $password,
                ) {
                    customer {
                        accountStatus
                        accountStatusUpdatedAt
                        addresses {
                            addressLine1
                            addressLine2
                            attributes {
                                customerAttributeId
                                customerAttributeOptionId
                                value
                            }
                            city {
                                code
                                id
                                name
                            }
                            company
                            country {
                                code
                                id
                                iso2
                                iso3
                                name
                            }
                            createdAt
                            deleted
                            district {
                                code
                                id
                                name
                            }
                            firstName
                            id
                            identityNumber
                            isDefault
                            lastName
                            phone
                            postalCode
                            region {
                                id
                                name
                            }
                            state {
                                code
                                id
                                name
                            }
                            taxNumber
                            taxOffice
                            title
                            updatedAt
                        }
                        attributes {
                            customerAttributeId
                            customerAttributeOptionId
                            value
                        }
                        birthDate
                        createdAt
                        customerGroupIds
                        customerSegmentIds
                        customerSequence
                        deleted
                        email
                        emailVerifiedDate
                        firstName
                        fullName
                        gender
                        id
                        isEmailVerified
                        isPhoneVerified
                        lastName
                        note
                        orderCount
                        passwordUpdateDate
                        phone
                        phoneSubscriptionStatus
                        phoneSubscriptionStatusUpdatedAt
                        phoneVerifiedDate
                        preferredLanguage
                        priceListId
                        priceListRules {
                            discountRate
                            filters {
                                type
                                valueList
                            }
                            priceListId
                            shouldMatchAllFilters
                            value
                            valueType
                        }
                        registrationSource
                        smsSubscriptionStatus
                        smsSubscriptionStatusUpdatedAt
                        subscriptionStatus
                        subscriptionStatusUpdatedAt
                        tagIds
                        updatedAt
                    }
                    token
                    tokenExpiry
                }
            }
        `;

    try {
      const response = await axios.post(
        'https://api.myikas.com/api/sf/graphql?op=customerLogin',
        {
          query,
          variables: {
            email,
            password,
            captchaToken: null,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-api-key': this.ikasXapiKey,
          },
        },
      );

      console.log('IKAS response:', response.data);

      return response.data;
    } catch (error) {
      console.error('IKAS login error:', error.response?.data || error);
      throw error;
    }
  }

  async registerCustomer(customerData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const query = `
            mutation customerRegister(
                $captchaToken: String
                $email: String!
                $firstName: String!
                $isAcceptMarketing: Boolean!
                $lastName: String!
                $password: String!
                $phone: String
            ) {
                customerRegister(
                    captchaToken: $captchaToken
                    email: $email
                    firstName: $firstName
                    isAcceptMarketing: $isAcceptMarketing
                    lastName: $lastName
                    password: $password
                    phone: $phone
                ) {
                    customer {
                        accountStatus
                        accountStatusUpdatedAt
                        addresses {
                            addressLine1
                            addressLine2
                            attributes {
                                customerAttributeId
                                customerAttributeOptionId
                                value
                            }
                            city {
                                code
                                id
                                name
                            }
                            company
                            country {
                                code
                                id
                                iso2
                                iso3
                                name
                            }
                            createdAt
                            deleted
                            district {
                                code
                                id
                                name
                            }
                            firstName
                            id
                            identityNumber
                            isDefault
                            lastName
                            phone
                            postalCode
                            region {
                                id
                                name
                            }
                            state {
                                code
                                id
                                name
                            }
                            taxNumber
                            taxOffice
                            title
                            updatedAt
                        }
                        attributes {
                            customerAttributeId
                            customerAttributeOptionId
                            value
                        }
                        birthDate
                        createdAt
                        customerGroupIds
                        customerSegmentIds
                        customerSequence
                        deleted
                        email
                        emailVerifiedDate
                        firstName
                        fullName
                        gender
                        id
                        isEmailVerified
                        isPhoneVerified
                        lastName
                        note
                        orderCount
                        passwordUpdateDate
                        phone
                        phoneSubscriptionStatus
                        phoneSubscriptionStatusUpdatedAt
                        phoneVerifiedDate
                        preferredLanguage
                        priceListId
                        priceListRules {
                            discountRate
                            filters {
                                type
                                valueList
                            }
                            priceListId
                            shouldMatchAllFilters
                            value
                            valueType
                        }
                        registrationSource
                        smsSubscriptionStatus
                        smsSubscriptionStatusUpdatedAt
                        subscriptionStatus
                        subscriptionStatusUpdatedAt
                        tagIds
                        updatedAt
                    }
                    token
                    tokenExpiry
                }
            }
        `;

    try {
      const response = await axios.post(
        'https://api.myikas.com/api/sf/graphql?op=customerRegister',
        {
          query,
          variables: {
            ...customerData,
            captchaToken: null,
            isAcceptMarketing: false,
            phone: null,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('IKAS registration error:', error.response?.data || error);
      throw error;
    }
  }
}

export const createIkasUser = async (userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isAcceptMarketing: boolean;
  captchaToken: string | null;
  phone: string;
}) => {
  const mutation = `
        mutation registerCustomer(
            $attributes: [CustomerAttributeValueInput!], 
            $captchaToken: String, 
            $email: String!, 
            $firstName: String!, 
            $isAcceptMarketing: Boolean, 
            $lastName: String!, 
            $locale: String, 
            $orderId: String, 
            $password: String!, 
            $phone: String, 
            $preferredLanguage: String
        ) {
            registerCustomer(
                attributes: $attributes,
                captchaToken: $captchaToken,
                email: $email,
                firstName: $firstName,
                isAcceptMarketing: $isAcceptMarketing,
                lastName: $lastName,
                locale: $locale,
                orderId: $orderId,
                password: $password,
                phone: $phone,
                preferredLanguage: $preferredLanguage,
            ) {
                customer {
                    id
                    email
                    firstName
                    lastName
                    phone
                    isEmailVerified
                    isPhoneVerified
                }
                token
                tokenExpiry
            }
        }
    `;

  try {
    const response = await fetch(
      'https://api.myikas.com/api/sf/graphql?op=registerCustomer',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            ...userData,
            attributes: [],
            locale: null,
            orderId: null,
            preferredLanguage: null,
          },
        }),
      },
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return data.data.registerCustomer;
  } catch (error) {
    throw error;
  }
};
